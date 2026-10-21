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
import { podeAnexarAlteracaoContratual } from "@/shared/kernel/papeis";
import { err, type Result } from "@/shared/kernel/result";

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
    return this.desfazerUpload(input.clienteId, caminho, salvo.error);
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
