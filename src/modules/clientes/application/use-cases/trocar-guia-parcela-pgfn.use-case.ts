import type {
  TrocarGuiaParcelaPgfnInput,
  TrocarGuiaParcelaPgfnPort,
} from "@/modules/clientes/application/ports/in/trocar-guia-parcela-pgfn.provider";
import type { ArquivoInspecionavelPort } from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import type {
  GuiaDaParcela,
  GuiaParcelaPgfnRepository,
} from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import type { LeitorDeGuiaDeParcelaPort } from "@/modules/clientes/application/ports/out/leitor-de-guia-de-parcela.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import {
  apagarObjeto,
  confirmarOuManter,
  desfazerUpload,
  revalidarPdfNoStorage,
} from "@/modules/clientes/application/use-cases/guia-parcela-pgfn-compartilhado.use-case";
import { conferirGuiaLida } from "@/modules/clientes/domain/value-objects/guia-parcela-pgfn.vo";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ResultadoIncertoError } from "@/shared/errors/resultado-incerto.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { podeEditarCadastroOperacional } from "@/shared/kernel/papeis";
import { err, type Result } from "@/shared/kernel/result";

// Troca o PDF de uma guia ainda não enviada: refaz a leitura e a conferência e a guia volta a
// "a confirmar" (ou já nasce confirmada, se tudo conferir). O objeto antigo só é apagado depois de o
// banco aceitar a troca; o banco recusa guia de competência já enviada.
export class TrocarGuiaParcelaPgfn implements TrocarGuiaParcelaPgfnPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly guias: GuiaParcelaPgfnRepository,
    private readonly storage: ArquivoInspecionavelPort,
    private readonly leitor: LeitorDeGuiaDeParcelaPort,
  ) {}

  async execute(input: TrocarGuiaParcelaPgfnInput): Promise<Result<GuiaDaParcela, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || !podeEditarCadastroOperacional(ator.papel, ator.setor)) {
      return err(
        new ForbiddenError(
          "Só Admin, Líder ou Funcionário do Simples Nacional trocam a guia da parcela.",
        ),
      );
    }

    const parcelamento = await this.guias.parcelamento(input.parcelamentoId);
    if (!parcelamento.ok) return parcelamento;
    const antigo = await this.guias.arquivo(input.parcelamentoId, input.competencia);
    if (!antigo.ok) return antigo;
    if (!parcelamento.value || !antigo.value) {
      return err(new NotFoundError("Não encontramos esta guia. Atualize a página."));
    }

    const leitura = await this.leitor.ler(input.pdf);
    const conferencia = conferirGuiaLida(leitura.lido ? leitura : null, parcelamento.value, {
      competencia: input.competencia,
    });
    if (!conferencia.ok) return conferencia;
    const { competencia, contaNegociacao, motivo } = conferencia.value;
    // A competência é a chave da guia e não muda na troca: outro mês é outra guia.
    if (competencia !== input.competencia) {
      return err(
        new ValidationError(
          "O PDF é de outra competência. Para esta guia, anexe o PDF do mesmo mês; para outro mês, anexe uma guia nova.",
        ),
      );
    }

    const caminho = `${parcelamento.value.clienteId}/guias-pgfn/${input.parcelamentoId}/${input.competencia}-${crypto.randomUUID()}.pdf`;
    const enviado = await this.storage.enviar(caminho, input.arquivo);
    if (!enviado.ok) return enviado;

    const recusa = await revalidarPdfNoStorage(this.storage, caminho);
    if (recusa) return desfazerUpload(this.storage, input.parcelamentoId, caminho, recusa);

    const trocada = await this.guias.substituir(
      input.parcelamentoId,
      input.competencia,
      { contaNegociacao, arquivoCaminho: caminho },
      motivo,
    );
    if (!trocada.ok) {
      if (trocada.error instanceof ResultadoIncertoError) {
        const gravou = await this.guias.gravada(input.parcelamentoId, competencia, caminho);
        // Resposta perdida não prova rollback: sem a leitura confirmando a troca, nenhum arquivo é apagado.
        if (!gravou.ok || !gravou.value) {
          return err(
            new EstadoInconsistenteError(
              `Não foi possível confirmar se a guia foi trocada. Os arquivos foram mantidos (${caminho}); recarregue a página e confira antes de tentar de novo.`,
              input.parcelamentoId,
            ),
          );
        }
      } else {
        return desfazerUpload(this.storage, input.parcelamentoId, caminho, trocada.error);
      }
    }

    await apagarObjeto(this.storage, `troca, parcelamento=${input.parcelamentoId}`, antigo.value);
    return confirmarOuManter(
      this.guias,
      input.parcelamentoId,
      { competencia, contaNegociacao, arquivoCaminho: caminho },
      motivo,
    );
  }
}
