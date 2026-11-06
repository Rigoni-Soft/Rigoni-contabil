import type { DestinatarioDeComunicacao } from "@/modules/atendimento/application/ports/in/entregar-comunicacao-por-canais.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Cliente com Parcelamento pendente e o que o job precisa para entregar a guia a ele.
export type ClienteParaParcelamento = DestinatarioDeComunicacao & { clienteId: string };

export interface ClientesParaParcelamentoPort {
  // Clientes com tem parcelamento positivo e Parcelamento pendente (leitura paginada por cursor,
  // completa ou erro).
  listarPendentes(): Promise<Result<ClienteParaParcelamento[], AppError>>;
  // Reserva a entrega: token da tentativa, ou null se já não está pendente (outro job ou o
  // Funcionário mexeu antes) ou outra tentativa vigente a reservou. Não muda o estado: o
  // Parcelamento só vira enviado ao concluir.
  reservar(clienteId: string): Promise<Result<string | null, AppError>>;
  // A entrega foi aceita: pendente → enviado, auditado com a URA como ator, só com a posse da
  // reserva. false: sem a posse ou o Funcionário já havia mexido.
  concluir(clienteId: string, token: string): Promise<Result<boolean, AppError>>;
  // A entrega falhou sem aceite: libera a reserva.
  liberar(clienteId: string, token: string): Promise<Result<void, AppError>>;
}
