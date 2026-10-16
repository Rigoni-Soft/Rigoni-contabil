import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { ANEXO_TAMANHO_MAXIMO, ehOggOpus } from "@/shared/kernel/anexo";

import { DownloadMidiaFalsoGateway } from "./download-midia-falso.gateway";

describe("DownloadMidiaFalsoGateway", () => {
  const gateway = new DownloadMidiaFalsoGateway();

  it("devolve um ogg/opus válido para o id de áudio de teste", async () => {
    const r = await gateway.baixar("midia-teste-audio");
    expect(r.ok && r.value.mime).toBe("audio/ogg; codecs=opus");
    expect(r.ok && ehOggOpus(r.value.bytes)).toBe(true);
  });

  it.each([
    ["midia-teste-imagem", "image/png"],
    ["midia-teste-documento", "application/pdf"],
    ["midia-teste-svg", "image/svg+xml"],
  ])("devolve %s como %s", async (id, mime) => {
    const r = await gateway.baixar(id);
    expect(r.ok && r.value.mime).toBe(mime);
  });

  it("o arquivo grande passa do limite", async () => {
    const r = await gateway.baixar("midia-teste-grande");
    expect(r.ok && r.value.bytes.byteLength).toBeGreaterThan(ANEXO_TAMANHO_MAXIMO);
  });

  it("id desconhecido é falha permanente; o provedor fora do ar é transitória", async () => {
    const desconhecida = await gateway.baixar("qualquer");
    expect(!desconhecida.ok && desconhecida.error).toBeInstanceOf(ValidationError);
    const foraDoAr = await gateway.baixar("midia-teste-fora-do-ar");
    expect(!foraDoAr.ok && foraDoAr.error).toBeInstanceOf(ServicoExternoError);
  });
});
