import { GET, POST } from "./encerrar-por-silencio.webhook";

/**
 * Job de encerramento automático: autenticar não basta, a flag manda.
 */
const executar = jest.fn();
let ativo = false;
let autorizado = true;

jest.mock("@/main/atendimento.factory", () => ({
  encerramentoAutomaticoAtivo: () => ativo,
  makeAutenticacaoJob: () => ({ autorizado: () => autorizado }),
  makeEncerrarPorSilencio: () => ({ execute: executar }),
}));

const requisicao = () => new Request("http://localhost/api/jobs/encerramento");

describe("job de encerramento automático", () => {
  beforeEach(() => {
    executar.mockReset();
    executar.mockResolvedValue({ ok: true, value: { encerrados: 3, falhas: 0 } });
    ativo = false;
    autorizado = true;
  });

  it("sem segredo válido recusa com 401 e não executa", async () => {
    autorizado = false;
    ativo = true;

    const resposta = await POST(requisicao());

    expect(resposta.status).toBe(401);
    expect(executar).not.toHaveBeenCalled();
  });

  it("autenticado mas desligado responde ativa=false sem ler nem alterar nada", async () => {
    const resposta = await GET(requisicao());

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ ativa: false });
    expect(executar).not.toHaveBeenCalled();
  });

  it("autenticado e ligado encerra e responde quantos foram", async () => {
    ativo = true;

    const resposta = await POST(requisicao());

    expect(resposta.status).toBe(200);
    expect(executar).toHaveBeenCalledTimes(1);
    expect(await resposta.json()).toEqual({ encerrados: 3, falhas: 0 });
  });

  it("falha do banco responde 502", async () => {
    ativo = true;
    executar.mockResolvedValue({ ok: false, error: new Error("banco fora") });

    const resposta = await POST(requisicao());

    expect(resposta.status).toBe(502);
  });
});
