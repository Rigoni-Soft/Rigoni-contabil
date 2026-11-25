import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type EstadoDaGuiaPgfn = "sem_guia" | "a_confirmar";

export type PendenciaPgfn = { codigo: string; setor: SetorSlug; estado: EstadoDaGuiaPgfn };

export type ClienteComParcelamentoPgfn = {
  clienteId: string;
  empresa: string;
  pendencias: PendenciaPgfn[];
};

export interface ClientesComParcelamentoPgfnPort {
  listar(): Promise<Result<ClienteComParcelamentoPgfn[], AppError>>;
}
