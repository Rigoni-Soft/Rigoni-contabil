import type {
  AnexarGuiaParcelaPgfnInput,
  AnexarGuiaParcelaPgfnPort,
} from "@/modules/clientes/application/ports/in/anexar-guia-parcela-pgfn.provider";
import type { ArquivoInspecionavelPort } from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import type {
  GuiaDaParcela,
  GuiaParcelaPgfnRepository,
} from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import {
  validarGuiaParcelaPgfn,
  type GuiaParcelaPgfnProps,
} from "@/modules/clientes/domain/value-objects/guia-parcela-pgfn.vo";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ResultadoIncertoError } from "@/shared/errors/resultado-incerto.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { podeEditarCadastroOperacional } from "@/shared/kernel/papeis";
import { err, ok, type Result } from "@/shared/kernel/result";

// Mesmo teto da Server Action (corpo de 4,5 MB na Vercel, ADR 0007): o Storage é relido aqui.
const LIMITE_BYTES = 4 * 1024 * 1024;

const guiaCriada = (guia: GuiaParcelaPgfnProps): GuiaDaParcela => ({
  competencia: guia.competencia,
  contaNegociacao: guia.contaNegociacao,
  estado: "a_confirmar",
});

// A guia nasce "a confirmar"; confirmar é outro passo. Segundo anexo na competência, competência já
// enviada e Parcelamento que não é da PGFN são recusados pelo banco. O arquivo vai ao bucket privado
// antes da linha; qualquer recusa depois do upload o apaga.
export class AnexarGuiaParcelaPgfn implements AnexarGuiaParcelaPgfnPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly guias: GuiaParcelaPgfnRepository,
    private readonly storage: ArquivoInspecionavelPort,
  ) {}

  async execute(input: AnexarGuiaParcelaPgfnInput): Promise<Result<GuiaDaParcela, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || !podeEditarCadastroOperacional(ator.papel, ator.setor)) {
      return err(
        new ForbiddenError(
          "Só Admin, Líder ou Funcionário do Simples Nacional anexam a guia da parcela.",
        ),
      );
    }

    const parcelamento = await this.guias.parcelamento(input.parcelamentoId);
    if (!parcelamento.ok) return parcelamento;
    if (!parcelamento.value) {
      return err(new NotFoundError("Não encontramos este Parcelamento. Atualize a página."));
    }
    if (parcelamento.value.origem !== "pgfn") {
      return err(new ValidationError("Só Parcelamento da PGFN recebe guia anexada."));
    }

    // O nome do arquivo não entra no caminho: dois anexos da mesma competência nunca colidem no
    // Storage, e quem decide a duplicidade é o banco.
    const caminho = `${parcelamento.value.clienteId}/guias-pgfn/${input.parcelamentoId}/${input.competencia}-${crypto.randomUUID()}.pdf`;
    const guia = validarGuiaParcelaPgfn({
      competencia: input.competencia,
      contaNegociacao: input.contaNegociacao,
      arquivoCaminho: caminho,
    });
    if (!guia.ok) return guia;

    const enviado = await this.storage.enviar(caminho, input.arquivo);
    if (!enviado.ok) return enviado;

    const recusa = await this.revalidarNoStorage(caminho);
    if (recusa) return this.desfazerUpload(input.parcelamentoId, caminho, recusa);

    const salvo = await this.guias.anexar(input.parcelamentoId, guia.value);
    if (salvo.ok) return ok(guiaCriada(guia.value));
    if (salvo.error instanceof ResultadoIncertoError) {
      return this.reconciliar(input.parcelamentoId, guia.value);
    }
    return this.desfazerUpload(input.parcelamentoId, caminho, salvo.error);
  }

  private async revalidarNoStorage(caminho: string): Promise<AppError | null> {
    const objeto = await this.storage.inspecionar(caminho);
    if (!objeto.ok) return objeto.error;
    if (!objeto.value) return new ValidationError("Não foi possível conferir o arquivo enviado.");
    if (objeto.value.tipoMime !== "application/pdf") {
      return new ValidationError("A guia precisa ser um PDF.");
    }
    if (objeto.value.tamanho > LIMITE_BYTES) {
      return new ValidationError("O arquivo passa de 4 MB. Envie um arquivo menor.");
    }
    return null;
  }

  // Resposta perdida não prova rollback: só a leitura confirmando a linha vira sucesso; senão o
  // arquivo fica (apagar quebraria uma guia que ainda pode ter sido gravada) e pede conferência.
  private async reconciliar(
    parcelamentoId: string,
    guia: GuiaParcelaPgfnProps,
  ): Promise<Result<GuiaDaParcela, AppError>> {
    const gravada = await this.guias.gravada(parcelamentoId, guia.competencia, guia.arquivoCaminho);
    if (gravada.ok && gravada.value) return ok(guiaCriada(guia));
    return err(
      new EstadoInconsistenteError(
        `Não foi possível confirmar se a guia foi anexada. O arquivo foi mantido (${guia.arquivoCaminho}); recarregue a página e confira antes de tentar de novo.`,
        parcelamentoId,
      ),
    );
  }

  // Falha da própria remoção não é mascarada como o erro original: o arquivo ficou órfão.
  private async desfazerUpload(
    parcelamentoId: string,
    caminho: string,
    erro: AppError,
  ): Promise<Result<never, AppError>> {
    const removido = await this.storage.remover([caminho]);
    if (removido.ok) return err(erro);
    console.error(
      `Falha ao remover guia órfã (parcelamento=${parcelamentoId}, caminho=${caminho}):`,
      removido.error.message,
    );
    return err(
      new EstadoInconsistenteError(
        "Não foi possível anexar a guia nem remover o arquivo enviado. Avise o suporte.",
        parcelamentoId,
      ),
    );
  }
}
