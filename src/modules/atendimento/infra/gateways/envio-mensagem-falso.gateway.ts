import type {
  EnvioMensagemPort,
  MensagemEnviada,
} from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ok, type Result } from "@/shared/kernel/result";

// Adapter falso (padrão em dev/e2e): só registra, nunca envia. O real vive na #68.
// ponytail: lista em memória sem limite, some a cada restart; trocar por tabela se
// alguém precisar auditar o que "foi enviado" fora de testes.
export class EnvioMensagemFalsoGateway implements EnvioMensagemPort {
  readonly enviadas: MensagemEnviada[] = [];

  async enviar(mensagem: MensagemEnviada): Promise<Result<void, AppError>> {
    this.enviadas.push(mensagem);
    console.info(`[mensageria falsa] para ${mensagem.telefone}: ${mensagem.texto}`);
    return ok(undefined);
  }
}
