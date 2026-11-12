import { LeitorDeCartaoVisaoGateway } from "@/modules/rh/infra/gateways/leitor-de-cartao-visao.gateway";

const img = { bytes: new Uint8Array([0xff, 0xd8]), tipo: "image/jpeg" as const };
const resposta = (input: unknown, ok = true) =>
  (async () =>
    ({
      ok,
      json: async () => ({ content: [{ type: "tool_use", input }] }),
    }) as Response) as typeof fetch;

describe("LeitorDeCartaoVisaoGateway", () => {
  it("converte o JSON da ferramenta em minutos e anotações", async () => {
    const gw = new LeitorDeCartaoVisaoGateway(
      "k",
      "m",
      resposta({
        nome: "Erick",
        dias: [
          { dia: 1, batidas: [{ entrada: "08:30", saida: "12:30" }], extra: null, anotacao: null },
          { dia: 2, batidas: [], extra: null, anotacao: "atestado" },
        ],
      }),
    );
    const r = await gw.ler(img);
    expect(r.lido).toBe(true);
    expect(r.lido && r.leitura.dias[0].batidas).toEqual([{ entrada: 510, saida: 750 }]);
    expect(r.lido && r.leitura.dias[1].atestado).toBe(true);
  });

  it.each([
    ["formato fora do esquema", resposta({ nome: 1 })],
    ["status de erro", resposta({}, false)],
    [
      "rede caiu",
      (async () => {
        throw new Error("rede");
      }) as typeof fetch,
    ],
  ])("não lança: %s vira lido=false", async (_, http) => {
    expect(await new LeitorDeCartaoVisaoGateway("k", "m", http).ler(img)).toEqual({ lido: false });
  });

  it("manda a chave, o modelo e a imagem em base64", async () => {
    const http = jest.fn(resposta({ nome: null, dias: [] }));
    await new LeitorDeCartaoVisaoGateway("segredo", "modelo-x", http).ler(img);
    const [, init] = http.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("segredo");
    expect(JSON.parse(init.body as string).model).toBe("modelo-x");
    expect(init.body).toContain("/9g=");
  });
});
