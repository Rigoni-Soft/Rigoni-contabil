import type { ChaveGuia } from "@/modules/atendimento/domain/services/guia-guardada.service";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type GuiaPublicada = { url: string; caminho: string };

// Guarda o PDF da guia e devolve o endereço temporário que o provedor de mensagem/e-mail busca e o
// caminho do objeto. O caminho é a referência imutável da versão publicada: quem registra o envio
// aceito guarda esse caminho, e só ele é reenviado.
export interface GuiaPublicadaPort {
  publicar(
    clienteId: string,
    guia: { nomeArquivo: string; pdfBase64: string },
    chave: ChaveGuia,
  ): Promise<Result<GuiaPublicada, AppError>>;
  // Novo endereço do objeto exato que foi entregue (o `caminho` guardado no registro do envio):
  // reenvio sem chamar o provedor fiscal. Nunca escolhe entre versões do período; o caminho de outro
  // Cliente é recusado.
  reencontrar(clienteId: string, caminho: string): Promise<Result<string, AppError>>;
}
