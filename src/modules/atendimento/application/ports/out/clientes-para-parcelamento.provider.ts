import type { DestinatarioDeComunicacao } from "@/modules/atendimento/application/ports/in/entregar-comunicacao-por-canais.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Cliente com Parcelamento pendente e o que o job precisa para entregar a guia a ele.
export type ClienteParaParcelamento = DestinatarioDeComunicacao & { clienteId: string };

export interface ClientesParaParcelamentoPort {
  // Clientes com tem parcelamento positivo e Parcelamento pendente.
  listarPendentes(): Promise<Result<ClienteParaParcelamento[], AppError>>;
  // Parcelamento pendente → enviado, auditado com a URA como ator. `false` se já não estava
  // pendente (outro job ou o Funcionário mexeu antes): quem não reivindicou não envia.
  reivindicar(clienteId: string): Promise<Result<boolean, AppError>>;
  // A entrega falhou: devolve o Parcelamento a pendente.
  desfazer(clienteId: string): Promise<Result<void, AppError>>;
}
