import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type AlertaSetor = {
  setor: SetorSlug;
  tipo: "das_pendente" | "falha_envio" | "contato_ausente";
  clienteId: string;
  mensagem: string;
};

// Alerta gravado para o painel do Funcionário do setor (a tela lê `alertas_setor`).
export interface AlertaSetorPort {
  alertar(alerta: AlertaSetor): Promise<Result<void, AppError>>;
}
