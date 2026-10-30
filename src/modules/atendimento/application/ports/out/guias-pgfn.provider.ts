import type { ParcelamentoDoCliente } from "@/modules/atendimento/application/ports/out/parcelamentos-do-cliente.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Guia anexada e confirmada à mão pelo escritório; `caminho` é o PDF no bucket dos acordos.
export type GuiaPgfnConfirmada = { competencia: string; caminho: string };

// Guia já entregue: `caminho` é o PDF publicado no envio aceito (null: registro anterior ao caminho guardado).
export type GuiaPgfnEntregue = { competencia: string; caminho: string | null };

export type ParcelamentoPgfn = ParcelamentoDoCliente & {
  guias: GuiaPgfnConfirmada[];
  entregues: GuiaPgfnEntregue[];
};

export interface GuiasPgfnPort {
  // Parcelamentos PGFN em aberto e com parcelas restantes, com as guias confirmadas e as já entregues de cada um.
  listarEmAberto(clienteId: string): Promise<Result<ParcelamentoPgfn[], AppError>>;
  // PDF da guia em base64: sempre do banco, nunca do provedor fiscal. O caminho de outro Cliente é
  // recusado.
  ler(clienteId: string, caminho: string): Promise<Result<string, AppError>>;
  // Reserva a versão da guia (o caminho listado) para a primeira entrega: enquanto durar, troca e
  // remoção são recusadas. Devolve o token do dono. `null`: a guia mudou desde a listagem ou outra
  // tentativa a detém; não deve ser entregue.
  reservar(
    parcelamentoId: string,
    competencia: string,
    caminho: string,
  ): Promise<Result<string | null, AppError>>;
  // Solta a reserva do dono (entrega que não se completou); token alheio ou vencido não tem efeito.
  liberar(
    parcelamentoId: string,
    competencia: string,
    token: string,
  ): Promise<Result<void, AppError>>;
}
