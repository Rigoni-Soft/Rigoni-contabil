import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ArquivoAnexo = { nome: string; tipoMime: string; conteudo: Uint8Array };

// Endereço de curta duração e o instante em que deixa de valer (ISO).
export type LinkTemporario = { url: string; expiraEm: string };

// Arquivos que o Funcionário envia ao cliente. Bucket privado próprio, separado dos documentos do
// Cliente: o arquivo só sai dele por link temporário.
export interface AnexosAtendimentoPort {
  // Devolve o caminho do objeto, a guardar na Mensagem.
  guardar(input: {
    atendimentoId: string;
    arquivo: ArquivoAnexo;
  }): Promise<Result<string, AppError>>;
  // Em lote, um round-trip só. A chave do resultado é o caminho pedido.
  linksTemporarios(caminhos: string[]): Promise<Result<Record<string, LinkTemporario>, AppError>>;
  remover(caminho: string): Promise<Result<void, AppError>>;
}
