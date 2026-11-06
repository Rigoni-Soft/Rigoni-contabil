import type { ArquivoAnexo } from "@/modules/atendimento/application/ports/out/anexos-atendimento.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Os bytes vêm no pedido (`arquivo`) ou o navegador já subiu o objeto em partes direto ao Storage
// (`guardado`). Nos dois, a miniatura é opcional e só para imagem: otimização, inválida ou com falha
// é ignorada.
export type EntradaEnviarAnexo = {
  atendimentoId: string;
  legenda?: string;
} & ({ arquivo: ArquivoAnexo } | { guardado: { caminho: string; nome: string } }) & {
    miniatura?: ArquivoAnexo;
  };

// Imagem, arquivo ou áudio do Funcionário ao cliente do Atendimento, com legenda opcional (não vale
// para áudio), entregue no WhatsApp e guardada como Mensagem do Funcionário.
export interface EnviarAnexoAoClientePort {
  execute(input: EntradaEnviarAnexo): Promise<Result<void, AppError>>;
}
