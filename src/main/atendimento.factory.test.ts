/**
 * Fail-open do webhook público: em produção, segredos ausentes ou
 * iguais ao placeholder devem impedir tanto a validação de HMAC quanto a criação do client
 * privilegiado. O `env` é avaliado na importação, então cada caso reimporta a factory.
 */
import type * as FactoryModulo from "./atendimento.factory";

const REAIS = {
  MENSAGERIA_SEGREDO_ASSINATURA: "assinatura-real",
  MENSAGERIA_TOKEN_VERIFICACAO: "token-real",
  MENSAGERIA_SEGREDO_SESSAO: "sessao-real",
};
const ORIGINAL = { ...process.env };

function carregarFactory(ambiente: Record<string, string | undefined>) {
  jest.resetModules();
  process.env = { ...ORIGINAL, SUPABASE_SERVICE_ROLE_KEY: "chave-teste", ...ambiente } as never;
  const criarAdmin = jest.fn(() => ({}));
  jest.doMock("@/main/supabase-admin.factory", () => ({ createSupabaseAdmin: criarAdmin }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const factory = require("@/main/atendimento.factory") as typeof FactoryModulo;
  return { factory, criarAdmin };
}

afterEach(() => {
  process.env = ORIGINAL;
});

describe("atendimento.factory em produção", () => {
  it("sem segredos (defaults de dev) recusa HMAC e não cria o client privilegiado", async () => {
    const { factory, criarAdmin } = carregarFactory({
      NODE_ENV: "production",
      MENSAGERIA_SEGREDO_ASSINATURA: undefined,
      MENSAGERIA_TOKEN_VERIFICACAO: undefined,
      MENSAGERIA_SEGREDO_SESSAO: undefined,
    });
    expect(() => factory.makeAutenticarWebhook()).toThrow(/bloqueado em produção/);
    await expect(factory.makeReceberMensagem()).rejects.toThrow(/bloqueado em produção/);
    expect(criarAdmin).not.toHaveBeenCalled();
  });

  it("com os placeholders explícitos também recusa", () => {
    const { factory } = carregarFactory({
      NODE_ENV: "production",
      MENSAGERIA_SEGREDO_ASSINATURA: "segredo-falso",
      MENSAGERIA_TOKEN_VERIFICACAO: "token-falso",
      MENSAGERIA_SEGREDO_SESSAO: "segredo-sessao-falso",
    });
    expect(() => factory.makeAutenticarWebhook()).toThrow(/bloqueado em produção/);
  });

  it("com segredos reais monta autenticação e caso de uso", () => {
    const { factory, criarAdmin } = carregarFactory({ NODE_ENV: "production", ...REAIS });
    expect(factory.makeAutenticarWebhook().verificarToken("token-real").ok).toBe(true);
    expect(() => factory.makeReceberMensagem()).not.toThrow();
    expect(criarAdmin).toHaveBeenCalled();
  });

  it("fora de produção os defaults de dev seguem valendo", () => {
    const { factory } = carregarFactory({
      NODE_ENV: "test",
      MENSAGERIA_SEGREDO_ASSINATURA: undefined,
      MENSAGERIA_TOKEN_VERIFICACAO: undefined,
      MENSAGERIA_SEGREDO_SESSAO: undefined,
    });
    expect(factory.makeAutenticarWebhook().verificarToken("token-falso").ok).toBe(true);
  });
});
