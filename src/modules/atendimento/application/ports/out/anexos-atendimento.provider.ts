import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ArquivoAnexo = { nome: string; tipoMime: string; conteudo: Uint8Array };

// Endereços de curta duração e o instante em que deixam de valer (ISO).
// `url` baixa o arquivo (cabeçalho de anexo, com o nome original); `urlVisualizacao` o serve para o
// navegador mostrar, sem forçar o download.
export type LinkTemporario = { url: string; urlVisualizacao: string; expiraEm: string };

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
  // Posse do objeto que o navegador subiu em partes: `true` se esta tentativa o reservou (e é dona
  // dele: pode removê-lo se falhar); `false` se outra finalização já o reservou ou uma Mensagem já o
  // referencia, e então ele NÃO é desta tentativa e não pode ser removido. A reserva de quem concluiu
  // fica (consumo idempotente); `liberarReserva` é de quem falhou e removeu o objeto.
  reservar(caminho: string, atendimentoId: string): Promise<Result<boolean, AppError>>;
  liberarReserva(caminho: string): Promise<Result<void, AppError>>;
  // O que o Storage tem do objeto (null: não existe). Usado quando o navegador sobe o arquivo em
  // partes: tipo e tamanho vêm do Storage, não do pedido.
  inspecionar(
    caminho: string,
  ): Promise<Result<{ tipoMime: string; tamanho: number } | null, AppError>>;
  baixar(caminho: string): Promise<Result<Uint8Array, AppError>>;
  // Só os primeiros bytes (para conferir o codec sem baixar o arquivo todo).
  cabecalho(caminho: string, bytes: number): Promise<Result<Uint8Array, AppError>>;
}
