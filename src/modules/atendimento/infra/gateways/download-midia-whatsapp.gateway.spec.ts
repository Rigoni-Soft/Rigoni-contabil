import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";

import { DownloadMidiaWhatsappGateway } from "./download-midia-whatsapp.gateway";

const json = (status: number, corpo: unknown) => ({
  ok: status < 300,
  status,
  json: async () => corpo,
});
const arquivo = (bytes: number[]) => ({
  ok: true,
  status: 200,
  arrayBuffer: async () => new Uint8Array(bytes).buffer,
});
const gateway = (http: unknown) => new DownloadMidiaWhatsappGateway("tok", http as typeof fetch);

describe("DownloadMidiaWhatsappGateway", () => {
  it("troca o id pelo endereço e baixa o arquivo com bearer", async () => {
    const http = jest
      .fn()
      .mockResolvedValueOnce(json(200, { url: "https://cdn/x", mime_type: "image/png" }))
      .mockResolvedValueOnce(arquivo([1, 2, 3]));
    const r = await gateway(http).baixar("m1");

    expect(r).toEqual({ ok: true, value: { bytes: new Uint8Array([1, 2, 3]), mime: "image/png" } });
    expect(http.mock.calls[0][0]).toBe("https://graph.facebook.com/v21.0/m1");
    expect(http.mock.calls[1][0]).toBe("https://cdn/x");
    expect(http.mock.calls[1][1].headers).toEqual({ Authorization: "Bearer tok" });
  });

  it("mídia expirada (404) é permanente; 5xx e rede são transitórios", async () => {
    const r404 = await gateway(jest.fn(async () => json(404, {}))).baixar("m1");
    const r500 = await gateway(jest.fn(async () => json(500, {}))).baixar("m1");
    const rede = await gateway(jest.fn().mockRejectedValue(new Error("x"))).baixar("m1");

    expect(!r404.ok && r404.error).toBeInstanceOf(ValidationError);
    expect(!r500.ok && r500.error).toBeInstanceOf(ServicoExternoError);
    expect(!rede.ok && rede.error).toBeInstanceOf(ServicoExternoError);
  });

  it("resposta sem url/mime é falha do serviço", async () => {
    const r = await gateway(jest.fn(async () => json(200, {}))).baixar("m1");
    expect(!r.ok && r.error).toBeInstanceOf(ServicoExternoError);
  });
});
