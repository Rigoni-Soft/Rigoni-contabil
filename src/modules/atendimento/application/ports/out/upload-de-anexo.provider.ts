import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Roda no navegador: sobe o arquivo em partes direto ao Storage, com a sessão do usuário (a RLS do
// bucket decide quem grava), sem passar pelo corpo de uma Server Action. Devolve o caminho do objeto,
// que o servidor confere e entrega (docs/adr/0007).
export interface UploadDeAnexoPort {
  enviar(input: {
    atendimentoId: string;
    nome: string;
    tipoMime: string;
    conteudo: Blob;
  }): Promise<Result<string, AppError>>;
}
