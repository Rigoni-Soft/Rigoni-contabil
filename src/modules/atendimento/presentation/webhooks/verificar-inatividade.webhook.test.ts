import { GET, POST } from "./verificar-inatividade.webhook";

/**
 * Job de inatividade: autenticar não basta, a flag manda.
 */
const executar = jest.fn();
let ativa = false;
let autorizado = true;

jest.mock("@/main/atendimento.factory", () => ({
  inatividadeAutomaticaAtiva: () => ativa,
  makeAutenticacaoJob: () => ({ autorizado: () => autorizado }),
  makeVerificarInatividade: () => ({ execute: executar }),
}));

const requisicao = () => new Request("http://localhost/api/jobs/inatividade");

describe("job de inatividade", () => {
  beforeEach(() => {
    executar.mockReset();
    executar.mockResolvedValue({
      ok: true,
      value: { avisados: 0, cancelados: 0, encerrados: 0, reentregues: 0, falhas: 0 },
    });
    ativa = false;
    autorizado = true;
  });

  it("sem segredo válido recusa com 401 e não executa", async () => {
    autorizado = false;
    ativa = true;

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

  it("autenticado e ligado executa a verificação", async () => {
    ativa = true;

    const resposta = await POST(requisicao());

    expect(resposta.status).toBe(200);
    expect(executar).toHaveBeenCalledTimes(1);
    expect(await resposta.json()).toMatchObject({ falhas: 0 });
  });

  it("rodada com falhas por Atendimento responde 500 com o resumo", async () => {
    ativa = true;
    executar.mockResolvedValue({
      ok: true,
      value: { avisados: 0, cancelados: 0, encerrados: 0, reentregues: 0, falhas: 2 },
    });

    const resposta = await POST(requisicao());

    expect(resposta.status).toBe(500);
    expect(await resposta.json()).toMatchObject({ falhas: 2 });
  });
});
