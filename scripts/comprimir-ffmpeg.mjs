// Antes do build: comprime o binário do ffmpeg-static (dezenas de MB) em brotli, para a função da
// conversa de áudio levar só o arquivo comprimido (docs/adr/0006). Em runtime, `resolver-ffmpeg`
// o descomprime em /tmp. Sem o pacote (ou sem o binário), não faz nada e o app usa o do pacote/PATH.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { brotliCompressSync, constants } from "node:zlib";

const binario = createRequire(import.meta.url)("ffmpeg-static");
if (!binario || !existsSync(binario)) {
  console.log("ffmpeg-static sem binário: nada a comprimir.");
  process.exit(0);
}

const bruto = readFileSync(binario);
const comprimido = brotliCompressSync(bruto, {
  params: {
    [constants.BROTLI_PARAM_QUALITY]: 9,
    [constants.BROTLI_PARAM_SIZE_HINT]: bruto.length,
  },
});
mkdirSync(".ffmpeg", { recursive: true });
writeFileSync(".ffmpeg/ffmpeg.br", comprimido);
console.log(
  `ffmpeg comprimido: ${(bruto.length / 1e6).toFixed(1)} MB → ${(comprimido.length / 1e6).toFixed(1)} MB`,
);
