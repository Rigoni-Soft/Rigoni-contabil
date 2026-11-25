import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type TipoAlertaSetor =
  | "das_pendente"
  | "falha_envio"
  | "contato_ausente"
  | "entrega_parcial"
  | "parcelamento_sem_guia"
  | "guia_pgfn_pendente"
  | "financeiro_ausente";

export type AlertaSetor = {
  setor: SetorSlug;
  tipo: TipoAlertaSetor;
  clienteId: string;
  mensagem: string;
};

export interface AlertaSetorPort {
  alertar(alerta: AlertaSetor): Promise<Result<void, AppError>>;
  resolverNaoRenovados(desde: Date, clienteIds: string[]): Promise<Result<void, AppError>>;
}
