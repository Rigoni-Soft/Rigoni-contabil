import { spawnSync } from "node:child_process";

import ffmpegEstatico from "ffmpeg-static";

import { FfmpegConversorDeAudioGateway } from "./ffmpeg-conversor-de-audio.gateway";

describe("FfmpegConversorDeAudioGateway", () => {
  it("sem o binário do ffmpeg, falha com mensagem clara em vez de lançar", async () => {
    const gateway = new FfmpegConversorDeAudioGateway("ffmpeg-que-nao-existe");

    const r = await gateway.paraOggOpus(new Uint8Array([1, 2, 3]));

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/não tem como converter o áudio/);
  });

  it("binário que sai com erro (entrada que não é áudio) devolve falha de conversão", async () => {
    // `node -e` sai com 1: faz o papel de um ffmpeg que recusa a entrada.
    const gateway = new FfmpegConversorDeAudioGateway(process.execPath);

    const r = await gateway.paraOggOpus(new Uint8Array([1, 2, 3]));

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/converter o áudio/);
  });

  it("converte webm/opus em ogg/opus com o ffmpeg do pacote", async () => {
    const webm = spawnSync(
      ffmpegEstatico!,
      ["-loglevel", "error", "-f", "lavfi", "-i", "sine=duration=0.5", "-c:a", "libopus"].concat([
        "-f",
        "webm",
        "pipe:1",
      ]),
      { maxBuffer: 1024 * 1024 },
    ).stdout;
    expect(webm.byteLength).toBeGreaterThan(0);

    const r = await new FfmpegConversorDeAudioGateway(ffmpegEstatico!).paraOggOpus(
      new Uint8Array(webm),
    );

    expect(r.ok).toBe(true);
    if (r.ok) expect(Buffer.from(r.value.subarray(0, 4)).toString("latin1")).toBe("OggS");
  });

  it("só resolve o binário quando há o que converter e falha com mensagem clara se a resolução falha", async () => {
    const resolver = jest.fn().mockRejectedValue(new Error("sem /tmp"));
    const gateway = new FfmpegConversorDeAudioGateway(resolver);
    expect(resolver).not.toHaveBeenCalled();

    const r = await gateway.paraOggOpus(new Uint8Array([1]));

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(r.ok).toBe(false);
  });
});
