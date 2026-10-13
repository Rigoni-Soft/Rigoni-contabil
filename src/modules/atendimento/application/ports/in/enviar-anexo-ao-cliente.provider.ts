import type { ArquivoAnexo } from "@/modules/atendimento/application/ports/out/anexos-atendimento.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Imagem ou arquivo do Funcionário ao cliente do Atendimento, com legenda opcional, entregue no
// WhatsApp e guardada como Mensagem do Funcionário.
export interface EnviarAnexoAoClientePort {
  execute(input: {
    atendimentoId: string;
    arquivo: ArquivoAnexo;
    // Só imagem: versão reduzida para a conversa (otimização; inválida ou com falha, é ignorada).
    miniatura?: ArquivoAnexo;
    legenda?: string;
  }): Promise<Result<void, AppError>>;
}
