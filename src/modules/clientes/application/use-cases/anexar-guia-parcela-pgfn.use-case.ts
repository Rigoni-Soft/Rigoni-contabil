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
  confirmarOuManter,
  desfazerUpload,
  revalidarPdfNoStorage,
} from "@/modules/clientes/application/use-cases/guia-parcela-pgfn.compartilhado";
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
import { err, type Result } from "@/shared/kernel/result";

// O PDF é lido e conferido antes de subir (CNPJ de outra empresa recusa sem tocar no Storage); tudo
// conferindo, a guia é confirmada na hora, senão nasce "a confirmar" com o motivo. O banco recusa
// segundo anexo, competência já enviada e Parcelamento que não é da PGFN; recusa depois do upload o apaga.
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

    const recusa = await revalidarPdfNoStorage(this.storage, caminho);
    if (recusa) return desfazerUpload(this.storage, input.parcelamentoId, caminho, recusa);

    const salvo = await this.guias.anexar(input.parcelamentoId, guia.value, motivo);
    if (salvo.ok) return confirmarOuManter(this.guias, input.parcelamentoId, guia.value, motivo);
    if (salvo.error instanceof ResultadoIncertoError) {
      return this.reconciliar(input.parcelamentoId, guia.value, motivo);
    }
    return desfazerUpload(this.storage, input.parcelamentoId, caminho, salvo.error);
  }

  // Resposta perdida não prova rollback: só a leitura confirmando a linha vira sucesso; senão o
  // arquivo fica (apagar quebraria uma guia que ainda pode ter sido gravada) e pede conferência.
  private async reconciliar(
    parcelamentoId: string,
    guia: GuiaParcelaPgfnProps,
    motivo: string | null,
  ): Promise<Result<GuiaDaParcela, AppError>> {
    const gravada = await this.guias.gravada(parcelamentoId, guia.competencia, guia.arquivoCaminho);
    if (gravada.ok && gravada.value)
      return confirmarOuManter(this.guias, parcelamentoId, guia, motivo);
    return err(
      new EstadoInconsistenteError(
        `Não foi possível confirmar se a guia foi anexada. O arquivo foi mantido (${guia.arquivoCaminho}); recarregue a página e confira antes de tentar de novo.`,
        parcelamentoId,
      ),
    );
  }
}
