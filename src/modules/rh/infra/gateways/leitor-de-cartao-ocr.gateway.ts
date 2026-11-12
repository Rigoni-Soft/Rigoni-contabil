import { createWorker } from "tesseract.js";

import type {
  ImagemDoCartao,
  LeitorDeCartaoPort,
  LeituraBruta,
} from "@/modules/rh/application/ports/out/leitor-de-cartao.provider";
import { lerTextoDoCartao } from "@/modules/rh/infra/mappers/texto-do-cartao.mapper";

// Primeiro leitor da cascata: OCR local (tesseract.js, modelo `por` versionado em assets/tessdata), sem rede
// e sem custo por foto. Só a foto em memória passa aqui: nada é gravado. Cada leitura sobe e derruba o
// próprio worker (função serverless não guarda estado entre chamadas).
export class LeitorDeCartaoOcrGateway implements LeitorDeCartaoPort {
  async ler(imagem: ImagemDoCartao): Promise<LeituraBruta> {
    const worker = await createWorker("por", 1, {
      langPath: `${process.cwd()}/assets/tessdata`,
      gzip: false,
      // O modelo já está no deploy: nada de cópia em cache (o disco da função é só leitura).
      cacheMethod: "none",
    });
    try {
      // Modo 6: um bloco uniforme de texto, o que melhor segue as linhas da tabela do cartão.
      await worker.setParameters({ tessedit_pageseg_mode: "6" as never });
      const { data } = await worker.recognize(Buffer.from(imagem.bytes), {}, { blocks: true });
      const linhas = (data.blocks ?? [])
        .flatMap((b) => b.paragraphs.flatMap((p) => p.lines))
        .map((l) => ({ texto: l.text, confianca: l.confidence }));
      const leitura = lerTextoDoCartao(linhas);
      return leitura ? { lido: true, leitura, origem: "ocr" } : { lido: false };
    } finally {
      await worker.terminate();
    }
  }
}
