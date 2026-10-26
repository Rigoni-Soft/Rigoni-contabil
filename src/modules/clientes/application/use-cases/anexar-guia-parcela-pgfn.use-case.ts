import type {
  AnexarGuiaParcelaPgfnInput,
  AnexarGuiaParcelaPgfnPort,
} from "@/modules/clientes/application/ports/in/anexar-guia-parcela-pgfn.provider";
import type { ArquivoInspecionavelPort } from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import type {
  GuiaDaParcela,
  GuiaParcelaPgfnRepository,
} from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import type { LeitorDeGuiaDeParcelaPort } from "@/modules/clientes/application/ports/out/leitor-de-guia-de-parcela.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import {
  conferirGuiaLida,
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

// Motivo da confirmação que o banco não aceitou na hora: o Funcionário confirma à mão.
const MOTIVO_CONFIRMACAO_FALHOU =
  "Não consegui confirmar a guia na hora: confira e confirme à mão.";

// O PDF é lido e conferido antes de subir: CNPJ de outra empresa recusa sem tocar no Storage. Tudo
// conferindo, a guia é confirmada na hora; senão nasce "a confirmar" com o motivo. Segundo anexo na competência, competência já
// enviada e Parcelamento que não é da PGFN são recusados pelo banco. O arquivo vai ao bucket privado
// antes da linha; qualquer recusa depois do upload o apaga.
export class AnexarGuiaParcelaPgfn implements AnexarGuiaParcelaPgfnPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly guias: GuiaParcelaPgfnRepository,
    private readonly storage: ArquivoInspecionavelPort,
    private readonly leitor: LeitorDeGuiaDeParcelaPort,
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

    const leitura = await this.leitor.ler(input.pdf);
    const conferencia = conferirGuiaLida(leitura.lido ? leitura : null, parcelamento.value, {
      competencia: input.competencia,
      contaNegociacao: input.contaNegociacao,
    });
    if (!conferencia.ok) return conferencia;
    const { competencia, motivo } = conferencia.value;

    // O nome do arquivo não entra no caminho: dois anexos da mesma competência nunca colidem no
    // Storage, e quem decide a duplicidade é o banco.
    const caminho = `${parcelamento.value.clienteId}/guias-pgfn/${input.parcelamentoId}/${competencia}-${crypto.randomUUID()}.pdf`;
    const guia = validarGuiaParcelaPgfn({
      competencia,
      contaNegociacao: conferencia.value.contaNegociacao,
      arquivoCaminho: caminho,
    });
    if (!guia.ok) return guia;

    const enviado = await this.storage.enviar(caminho, input.arquivo);
    if (!enviado.ok) return enviado;

    const recusa = await this.revalidarNoStorage(caminho);
    if (recusa) return this.desfazerUpload(input.parcelamentoId, caminho, recusa);

    const salvo = await this.guias.anexar(input.parcelamentoId, guia.value, motivo);
    if (salvo.ok) return this.confirmarOuManter(input.parcelamentoId, guia.value, motivo);
    if (salvo.error instanceof ResultadoIncertoError) {
      return this.reconciliar(input.parcelamentoId, guia.value, motivo);
    }
    return this.desfazerUpload(input.parcelamentoId, caminho, salvo.error);
  }

  // Sem motivo a guia é confirmada na hora; se o banco recusar, ela segue "a confirmar" (a confirmação
  // à mão continua valendo) e o arquivo e a linha não se perdem.
  private async confirmarOuManter(
    parcelamentoId: string,
    guia: GuiaParcelaPgfnProps,
    motivo: string | null,
  ): Promise<Result<GuiaDaParcela, AppError>> {
    const base = { competencia: guia.competencia, contaNegociacao: guia.contaNegociacao };
    if (motivo) return ok({ ...base, estado: "a_confirmar", motivo });
    const confirmada = await this.guias.confirmar(parcelamentoId, guia.competencia);
    if (confirmada.ok) return ok({ ...base, estado: "confirmada" });
    return ok({ ...base, estado: "a_confirmar", motivo: MOTIVO_CONFIRMACAO_FALHOU });
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
    motivo: string | null,
  ): Promise<Result<GuiaDaParcela, AppError>> {
    const gravada = await this.guias.gravada(parcelamentoId, guia.competencia, guia.arquivoCaminho);
    if (gravada.ok && gravada.value) return this.confirmarOuManter(parcelamentoId, guia, motivo);
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
