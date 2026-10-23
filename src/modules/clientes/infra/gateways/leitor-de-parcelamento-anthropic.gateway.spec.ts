import { LeitorDeParcelamentoAnthropicGateway } from "./leitor-de-parcelamento-anthropic.gateway";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

// Respostas gravadas do formato da Messages API; nenhum teste chama a rede.
const mensagem = (texto: string, stop_reason = "end_turn") => ({
  ok: true,
  status: 200,
  headers: new Headers({ "request-id": "req_1" }),
  json: async () => ({ stop_reason, content: [{ type: "text", text: texto }] }),
});
const erro = (
  status: number,
  corpo: unknown = { type: "error", error: { type: "api_error" } },
) => ({
  ok: false,
  status,
  headers: new Headers({ "request-id": "req_2" }),
  json: async () => corpo,
});

const gateway = (http: jest.Mock) =>
  new LeitorDeParcelamentoAnthropicGateway({ chave: "sk-teste", modelo: "claude-haiku-5-5" }, http);

describe("LeitorDeParcelamentoAnthropicGateway", () => {
  it("manda o PDF inline como bloco document com saída estruturada e lê o JSON", async () => {
    const http = jest
      .fn()
      .mockResolvedValue(mensagem('{"codigo":"12345","quantidadeDeParcelas":7}'));

    const r = await gateway(http).ler(PDF);

    expect(r).toEqual({ lido: true, codigo: "12345", quantidadeDeParcelas: 7 });
    const [url, init] = http.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers["x-api-key"]).toBe("sk-teste");
    const corpo = JSON.parse(init.body);
    expect(corpo.model).toBe("claude-haiku-5-5");
    expect(corpo.messages[0].content[0]).toEqual({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: "JVBERg==" },
    });
    expect(corpo.output_config.format.type).toBe("json_schema");
    expect(corpo.tool_choice).toBeUndefined();
  });

  it("PDF sem código (Recibo de Adesão): código nulo, quantidade lida", async () => {
    const http = jest.fn().mockResolvedValue(mensagem('{"codigo":null,"quantidadeDeParcelas":7}'));

    expect(await gateway(http).ler(PDF)).toEqual({
      lido: true,
      codigo: null,
      quantidadeDeParcelas: 7,
    });
  });

  it.each([
    ["refusal", mensagem("", "refusal"), "recusado"],
    ["max_tokens", mensagem('{"codigo":"1', "max_tokens"), "ilegivel"],
    ["JSON fora do schema", mensagem('{"x":1}'), "ilegivel"],
    ["quantidade nula", mensagem('{"codigo":"1","quantidadeDeParcelas":null}'), "ilegivel"],
    ["429 de limite de taxa", erro(429), "limite"],
    ["413 PDF grande demais", erro(413), "limite"],
    ["500", erro(500), "indisponivel"],
    ["529 sobrecarga", erro(529), "indisponivel"],
    ["401 chave inválida", erro(401), "indisponivel"],
    ["402 sem crédito", erro(402), "indisponivel"],
    ["rede", Promise.reject(new Error("ECONNRESET")), "indisponivel"],
  ])("%s vira lido:false (%s)", async (_nome, resposta, motivo) => {
    const http = jest.fn().mockReturnValue(resposta);
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await gateway(http).ler(PDF)).toEqual({ lido: false, motivo });
  });

  it("falha registra só o request-id no log, nunca o PDF", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await gateway(jest.fn().mockResolvedValue(erro(500))).ler(PDF);

    expect(JSON.stringify(log.mock.calls)).toContain("req_2");
    expect(JSON.stringify(log.mock.calls)).not.toContain("JVBERg");
  });
});
