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

// A guia como as portas de entrega a conhecem: o PDF vem do banco, sem valor (a identidade do
// registro é só a competência).
export const guiaPgfn = (codigo: string, competencia: string, pdfBase64: string): GuiaFiscal => ({
  nomeArquivo: `parcelamento-${codigo}-${competencia}.pdf`,
  pdfBase64,
  parcela: competencia,
});

// Reserva a versão listada da guia e lê o PDF dela: troca ou remoção no meio da primeira entrega é
// recusada até a reserva ser liberada com o token devolvido. Guia que mudou desde a listagem, ou que
// outra tentativa detém, não é lida nem entregue. Leitura que falha libera a reserva aqui mesmo.
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

// As guias confirmadas e ainda sem registro de envio, até a competência do mês corrente (AAAAMM),
// da mais antiga para a mais nova. Guia futura fica guardada; guia não confirmada nem entra na lista.
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

// URA, sem nenhuma pendente: a guia mais recente já entregue, para o pedido repetido reenviar o PDF
// registrado nela (nunca o anexo, que pode ter sido trocado), qualquer que seja a competência.
export function guiaPgfnAReenviar(parcelamento: ParcelamentoPgfn) {
  return [...parcelamento.entregues].sort((a, b) => b.competencia.localeCompare(a.competencia))[0];
}
