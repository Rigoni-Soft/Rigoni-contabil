import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliCompressSync } from "node:zlib";

import { resolverFfmpeg } from "./resolver-ffmpeg.gateway";

async function pasta() {
  return mkdtemp(join(tmpdir(), "resolver-ffmpeg-"));
}

describe("resolverFfmpeg", () => {
  it("descomprime o binário uma vez e reaproveita o arquivo nas chamadas seguintes", async () => {
    const dir = await pasta();
    const comprimido = join(dir, "ffmpeg.br");
    const destino = join(dir, "tmp", "ffmpeg");
    await writeFile(comprimido, brotliCompressSync(Buffer.from("binario-falso")));
    const alternativo = jest.fn().mockResolvedValue("ffmpeg");

    expect(await resolverFfmpeg({ comprimido, destino, alternativo })).toBe(destino);
    const primeira = (await stat(destino)).mtimeMs;
    expect(await readFile(destino, "utf8")).toBe("binario-falso");
    expect(await resolverFfmpeg({ comprimido, destino, alternativo })).toBe(destino);

    expect((await stat(destino)).mtimeMs).toBe(primeira);
    expect(alternativo).not.toHaveBeenCalled();
  });

  it("sem o arquivo comprimido, usa o binário alternativo", async () => {
    const dir = await pasta();

    const caminho = await resolverFfmpeg({
      comprimido: join(dir, "nao-existe.br"),
      destino: join(dir, "ffmpeg"),
      alternativo: async () => "/pacote/ffmpeg",
    });

    expect(caminho).toBe("/pacote/ffmpeg");
  });
});
