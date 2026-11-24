import type { GuiaFiscal } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type {
  GuiaPgfnConfirmada,
  GuiasPgfnPort,
  ParcelamentoPgfn,
} from "@/modules/atendimento/application/ports/out/guias-pgfn.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export type GuiaPgfnAEntregar = GuiaPgfnConfirmada & { parcelamento: ParcelamentoPgfn };

export const guiaPgfn = (codigo: string, competencia: string, pdfBase64: string): GuiaFiscal => ({
  nomeArquivo: `parcelamento-${codigo}-${competencia}.pdf`,
  pdfBase64,
  parcela: competencia,
});

export async function reservarELerGuiaPgfn(
  pgfn: GuiasPgfnPort,
  clienteId: string,
  parcelamentoId: string,
  { competencia, caminho }: GuiaPgfnConfirmada,
): Promise<Result<{ pdf: string; token: string }, AppError>> {
  const reservada = await pgfn.reservar(parcelamentoId, competencia, caminho);
  if (!reservada.ok) return reservada;
  const token = reservada.value;
  if (!token) {
    return err(
      new ServicoExternoError("A guia foi alterada; segue pendente para a próxima rodada."),
    );
  }
  const pdf = await pgfn.ler(clienteId, caminho);
  if (!pdf.ok) {
    await pgfn.liberar(parcelamentoId, competencia, token);
    return pdf;
  }
  return ok({ pdf: pdf.value, token });
}

export function guiasPgfnAEntregar(
  parcelamentos: ParcelamentoPgfn[],
  mes: string,
): GuiaPgfnAEntregar[] {
  return parcelamentos
    .flatMap((parcelamento) =>
      parcelamento.guias
        .filter(
          (g) => g.competencia <= mes && !parcelamento.parcelasEnviadas.includes(g.competencia),
        )
        .map((g) => ({ ...g, parcelamento })),
    )
    .sort((a, b) => a.competencia.localeCompare(b.competencia));
}

export function guiaPgfnAReenviar(parcelamento: ParcelamentoPgfn) {
  return [...parcelamento.entregues].sort((a, b) => b.competencia.localeCompare(a.competencia))[0];
}
