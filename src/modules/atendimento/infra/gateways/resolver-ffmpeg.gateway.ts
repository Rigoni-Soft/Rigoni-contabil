import { chmod, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { brotliDecompress } from "node:zlib";

const descomprimir = promisify(brotliDecompress);

async function existe(caminho: string) {
  return stat(caminho).then(
    () => true,
    () => false,
  );
}

// Onde está o ffmpeg a executar. Com o binário comprimido (gerado no build por
// scripts/comprimir-ffmpeg.mjs), descomprime uma vez em `destino` (/tmp, que sobrevive entre
// invocações da mesma instância); sem ele, usa o `alternativo` (pacote ffmpeg-static ou PATH).
export async function resolverFfmpeg({
  comprimido,
  destino,
  alternativo,
}: {
  comprimido: string;
  destino: string;
  alternativo: () => Promise<string>;
}): Promise<string> {
  if (await existe(destino)) return destino;
  if (!(await existe(comprimido))) return alternativo();
  await mkdir(dirname(destino), { recursive: true });
  // Escreve ao lado e renomeia: invocações simultâneas nunca executam um arquivo pela metade.
  const parcial = `${destino}.${process.pid}.${Date.now()}`;
  await writeFile(parcial, await descomprimir(await readFile(comprimido)));
  await chmod(parcial, 0o755);
  await rename(parcial, destino);
  return destino;
}
