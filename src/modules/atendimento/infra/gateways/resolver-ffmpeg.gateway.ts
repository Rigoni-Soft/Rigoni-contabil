import { chmod, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { brotliDecompress } from "node:zlib";

const PERMISSAO_DE_EXECUCAO = 0o755;
const descomprimir = promisify(brotliDecompress);

async function existe(caminho: string) {
  return stat(caminho).then(
    () => true,
    () => false,
  );
}

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
  const parcial = `${destino}.${process.pid}.${Date.now()}`;
  await writeFile(parcial, await descomprimir(await readFile(comprimido)));
  await chmod(parcial, PERMISSAO_DE_EXECUCAO);
  await rename(parcial, destino);
  return destino;
}
