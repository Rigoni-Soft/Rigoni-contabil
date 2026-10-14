import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type TipoAlertaSetor = "das_pendente" | "falha_envio" | "contato_ausente";

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
  // Fecha o que não foi renovado desde `desde`: a condição que o gerou deixou de existir.
  resolverNaoRenovados(desde: Date): Promise<Result<void, AppError>>;
}
