import type { ChaveGuia } from "@/modules/atendimento/domain/services/guia-guardada.service";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Guarda o PDF da guia e devolve o endereço temporário que o provedor de mensagem/e-mail busca.
export interface GuiaPublicadaPort {
  publicar(
    clienteId: string,
    guia: { nomeArquivo: string; pdfBase64: string },
    chave: ChaveGuia,
  ): Promise<Result<string, AppError>>;
  // Novo endereço da guia já publicada com essa chave, ou null se não existe: reenvio sem chamar o
  // provedor fiscal.
  reencontrar(clienteId: string, chave: ChaveGuia): Promise<Result<string | null, AppError>>;
  // Remove o que foi publicado para a chave quando a entrega foi recusada: só o que chegou ao contato
  // pode ser reencontrado depois. Só vale enquanto a chave não tem envio registrado. Melhor esforço:
  // falha aqui não muda o resultado da entrega.
  descartar(clienteId: string, chave: ChaveGuia): Promise<void>;
}
