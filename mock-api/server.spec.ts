/** @jest-environment node */
import type { AddressInfo } from "node:net";

const CNPJ = "11444777000161";

describe("mock fiscal: guias de parcelamento do CNPJ", () => {
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
  const parcelas = async (consulta = "") => {
    const r = await fetch(`${base}/clientes/${CNPJ}/parcelamentos${consulta}`);
    return {
      status: r.status,
      guias: (await r.json()).guias?.map((g: { parcela: string }) => g.parcela),
    };
  };

  it("no modo normal devolve a atrasada e a do mês; o endpoint por código não existe mais", async () => {
    await modo("normal");

    expect(await parcelas()).toEqual({ status: 200, guias: ["202608", "202609"] });
    expect((await fetch(`${base}/clientes/${CNPJ}/parcelamentos/PARC-AB12CD34`)).status).toBe(404);
    expect((await fetch(`${base}/clientes/${CNPJ}/parcelamento`)).status).toBe(404);
  });

  it("não emite as parcelas pedidas em ?ignorar=", async () => {
    await modo("normal");

    expect((await parcelas("?ignorar=202608")).guias).toEqual(["202609"]);
  });

  it.each([
    ["uma_parcela", ["202609"]],
    ["sem_parcelas", []],
  ])("modo %s", async (m, esperado) => {
    await modo(m);

    expect((await parcelas()).guias).toEqual(esperado);
  });

  it("o modo de parcelas não afeta o DAS nem a autorização", async () => {
    await modo("sem_parcelas");

    expect((await fetch(`${base}/clientes/${CNPJ}/das`)).status).toBe(200);
    expect((await fetch(`${base}/clientes/${CNPJ}/autorizacao`)).status).toBe(200);
  });

  it("modo falha responde 503 também nas guias de parcelamento", async () => {
    await modo("falha");

    expect((await parcelas()).status).toBe(503);
  });
});
