import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// `sem_guia`: falta anexar a guia do mês; `a_confirmar`: anexada, aguardando a confirmação.
export type EstadoDaGuiaPgfn = "sem_guia" | "a_confirmar";

export type PendenciaPgfn = { codigo: string; estado: EstadoDaGuiaPgfn };

export type ClienteComParcelamentoPgfn = {
  clienteId: string;
  empresa: string;
  // Parcelamentos PGFN em aberto sem guia confirmada da competência do mês. Vazio: o Cliente não
  // tem mais pendência (vem na lista para os alertas antigos dele serem resolvidos).
  pendencias: PendenciaPgfn[];
};

export interface ClientesComParcelamentoPgfnPort {
  // Clientes com Parcelamento PGFN em aberto (inclusive interno) ou com alerta deste job ainda
  // aberto (leitura paginada por cursor, completa ou erro).
  listar(): Promise<Result<ClienteComParcelamentoPgfn[], AppError>>;
}
