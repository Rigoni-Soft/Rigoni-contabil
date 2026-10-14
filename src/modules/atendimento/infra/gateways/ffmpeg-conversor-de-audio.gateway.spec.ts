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
});
