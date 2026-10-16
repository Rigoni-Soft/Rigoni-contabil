import { GET, POST } from "./executar-envio-guia-parcelamento.webhook";

/**
 * Job de envio da guia de parcelamento: autenticar não basta, a flag manda.
 */
const executar = jest.fn();
let ativa = false;
let autorizado = true;

jest.mock("@/main/atendimento.factory", () => ({
  lembretesAutomaticosAtivos: () => ativa,
  makeAutenticacaoJob: () => ({ autorizado: () => autorizado }),
  makeExecutarEnvioGuiaParcelamento: () => ({ execute: executar }),
}));

const requisicao = () => new Request("http://localhost/api/jobs/parcelamento");
const resumo = { executado: true, enviados: 0, alertas: 0, falhas: 0 };

describe("job de envio da guia de parcelamento", () => {
  beforeEach(() => {
    executar.mockReset();
    executar.mockResolvedValue({ ok: true, value: resumo });
    ativa = false;
    autorizado = true;
  });

  it("sem segredo válido recusa com 401 e não executa", async () => {
    autorizado = false;
    ativa = true;

    expect((await POST(requisicao())).status).toBe(401);
    expect(executar).not.toHaveBeenCalled();
  });

  it("autenticado mas desligado responde ativa=false sem executar", async () => {
    const resposta = await GET(requisicao());

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ ativa: false });
    expect(executar).not.toHaveBeenCalled();
  });

  it("autenticado e ligado executa o job", async () => {
    ativa = true;

    const resposta = await POST(requisicao());

    expect(resposta.status).toBe(200);
    expect(executar).toHaveBeenCalledTimes(1);
  });

  it("rodada com envio que falhou responde 500 com o resumo", async () => {
    ativa = true;
    executar.mockResolvedValue({ ok: true, value: { ...resumo, falhas: 2 } });

    const resposta = await POST(requisicao());

    expect(resposta.status).toBe(500);
    expect(await resposta.json()).toMatchObject({ falhas: 2 });
  });

  it("falha ao ler os Clientes responde 502", async () => {
    ativa = true;
    executar.mockResolvedValue({ ok: false, error: new Error("banco") });

    expect((await POST(requisicao())).status).toBe(502);
  });
});
