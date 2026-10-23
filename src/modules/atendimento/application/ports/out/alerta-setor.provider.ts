import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type TipoAlertaSetor =
  | "das_pendente"
  | "falha_envio"
  | "contato_ausente"
  | "entrega_parcial"
  | "parcelamento_sem_guia"
  | "financeiro_ausente";

export type AlertaSetor = {
  setor: SetorSlug;
  tipo: TipoAlertaSetor;
  clienteId: string;
  mensagem: string;
};

// Alerta gravado para o painel do Funcionário do setor (a tela lê `alertas_setor`).
export interface AlertaSetorPort {
  // Um alerta aberto por Cliente e tipo: repetir o alerta renova a mensagem e a data.
  alertar(alerta: AlertaSetor): Promise<Result<void, AppError>>;
  // Fecha o que não foi renovado desde `desde`, só dos Clientes avaliados (`clienteIds`): a
  // condição que o gerou deixou de existir. Quem não foi lido não teve a condição reavaliada.
  resolverNaoRenovados(desde: Date, clienteIds: string[]): Promise<Result<void, AppError>>;
}
