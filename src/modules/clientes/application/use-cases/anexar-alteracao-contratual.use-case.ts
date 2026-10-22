import type {
  AnexarAlteracaoContratualInput,
  AnexarAlteracaoContratualPort,
} from "@/modules/clientes/application/ports/in/anexar-alteracao-contratual.provider";
import type { ArquivoStoragePort } from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import type { ClienteRepository } from "@/modules/clientes/application/ports/out/cliente.repository";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { AlteracaoContratual } from "@/modules/clientes/domain/value-objects/alteracao-contratual.vo";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ResultadoIncertoError } from "@/shared/errors/resultado-incerto.error";
import { podeAnexarAlteracaoContratual } from "@/shared/kernel/papeis";
import { err, ok, type Result } from "@/shared/kernel/result";

// Tamanho do arquivo e data futura são barrados pelo schema da Server Action (única entrada da
// porta); aqui ficam papel, upload e compensação.
// A auditoria de sucesso (`cliente.anexar-alteracao`) e o aviso nascem de gatilhos no banco, na
// mesma transação do INSERT: aqui só se sobe o arquivo e, se a gravação falhar, se desfaz o upload.
export class AnexarAlteracaoContratual implements AnexarAlteracaoContratualPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly clientes: ClienteRepository,
    private readonly storage: ArquivoStoragePort,
  ) {}

  async execute(input: AnexarAlteracaoContratualInput): Promise<Result<void, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || !podeAnexarAlteracaoContratual(ator.papel)) {
      return err(new ForbiddenError("Só Admin anexa alteração contratual."));
    }

    const caminho = `${input.clienteId}/alteracoes-contratuais/${input.numero}-${input.arquivo.name}`;
    const alteracao = AlteracaoContratual.criar(input.numero, input.data, caminho);
    if (!alteracao.ok) return alteracao;

    const enviado = await this.storage.enviar(caminho, input.arquivo);
    if (!enviado.ok) return enviado;

    const salvo = await this.clientes.anexarAlteracaoContratual(input.clienteId, alteracao.value);
    if (salvo.ok) return salvo;
    if (salvo.error instanceof ResultadoIncertoError) {
      return this.reconciliar(input.clienteId, alteracao.value, salvo.error);
    }
    return this.desfazerUpload(input.clienteId, caminho, salvo.error);
  }

  // Resposta perdida não prova rollback: só remove o arquivo se a alteração comprovadamente não
  // está gravada. Sem conseguir confirmar, o arquivo fica (apagar quebraria a alteração gravada).
  // ponytail: uma só leitura; commit tardio depois dela ainda perde o arquivo. Reconciliar em job
  // por identidade da operação se isso aparecer em produção.
  private async reconciliar(
    clienteId: string,
    alteracao: AlteracaoContratual,
    erro: AppError,
  ): Promise<Result<void, AppError>> {
    const gravada = await this.clientes.alteracaoContratualGravada(
      clienteId,
      alteracao.numero,
      alteracao.arquivoCaminho,
    );
    if (!gravada.ok) {
      return err(
        new EstadoInconsistenteError(
          "Não foi possível confirmar se a alteração foi anexada. O arquivo foi mantido; confira o Cliente antes de tentar de novo.",
          clienteId,
        ),
      );
    }
    if (gravada.value) return ok(undefined);
    return this.desfazerUpload(clienteId, alteracao.arquivoCaminho, erro);
  }

  // Falha da própria remoção não é mascarada como o erro original: o arquivo ficou órfão.
  private async desfazerUpload(
    clienteId: string,
    caminho: string,
    erro: AppError,
  ): Promise<Result<void, AppError>> {
    const removido = await this.storage.remover([caminho]);
    if (removido.ok) return err(erro);
    console.error(
      `Falha ao remover arquivo órfão (cliente=${clienteId}, caminho=${caminho}):`,
      removido.error.message,
    );
    return err(
      new EstadoInconsistenteError(
        "Não foi possível anexar a alteração nem remover o arquivo enviado. Avise o suporte.",
        clienteId,
      ),
    );
  }
}
