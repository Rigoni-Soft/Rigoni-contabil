import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// `falhas`: Atendimentos em que algo deu errado (o job segue nos demais e tenta de novo na
// próxima rodada).
export type InatividadeVerificada = {
  avisados: number;
  cancelados: number;
  encerrados: number;
  // Mensagens finais de encerramentos anteriores que não tinham chegado ao cliente.
  reentregues: number;
  falhas: number;
};

export interface VerificarInatividadePort {
  execute(): Promise<Result<InatividadeVerificada, AppError>>;
}
