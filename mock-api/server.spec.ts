/** @jest-environment node */
import type { AddressInfo } from "node:net";

const CNPJ = "11444777000161";

describe("mock fiscal: guia por código de parcelamento", () => {
  let base: string;
  let fechar: () => void;

  beforeAll(async () => {
    process.env.MOCK_API_PORT = "0";
    const { servidor } = await import("./server.mjs");
    await new Promise<void>((pronto) => servidor.once("listening", pronto));
    base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
    fechar = () => servidor.close();
  });
  afterAll(() => fechar());

  const modo = (m: string) =>
    fetch(`${base}/__modo`, { method: "POST", body: JSON.stringify({ modo: m }) });
  const guia = (codigo = "PARC-AB12CD34") =>
    fetch(`${base}/clientes/${CNPJ}/parcelamentos/${codigo}`);

  it("no modo normal devolve a guia do código; o endpoint antigo não existe mais", async () => {
    await modo("normal");

    const r = await guia();

    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ parcela: "202609", valorCentavos: 45_000 });
    expect((await fetch(`${base}/clientes/${CNPJ}/parcelamento`)).status).toBe(404);
  });

  it.each(["codigo_desconhecido", "quitado", "fora_do_periodo", "ambiguo"])(
    "modo %s recusa a guia com o motivo",
    async (motivo) => {
      await modo(motivo);

      const r = await guia();

      expect(r.status).toBe(422);
      expect(await r.json()).toEqual({ motivo });
    },
  );

  it("o modo por motivo não afeta o DAS nem a autorização", async () => {
    await modo("quitado");

    expect((await fetch(`${base}/clientes/${CNPJ}/das`)).status).toBe(200);
    expect((await fetch(`${base}/clientes/${CNPJ}/autorizacao`)).status).toBe(200);
  });

  it("modo falha responde 503 também na guia por código", async () => {
    await modo("falha");

    expect((await guia()).status).toBe(503);
  });
});
