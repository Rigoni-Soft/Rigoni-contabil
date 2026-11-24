const BASE = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
};

const ORIGINAL = { ...process.env };

async function carregarEnv(variaveis: Record<string, string>) {
  jest.resetModules();
  process.env = { ...ORIGINAL, ...BASE, ...variaveis };
  await import("@/env");
}

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("env: Serpro trial em Production da Vercel", () => {
  const LEITORES_ESCOLHIDOS = {
    LEITURA_CARTAO_MODO: "indisponivel",
    EXTRACAO_CONVENCAO_MODO: "indisponivel",
  };

  it("recusa SERPRO_AMBIENTE=trial com o modo serpro ligado", async () => {
    await expect(
      carregarEnv({
        VERCEL_ENV: "production",
        ...LEITORES_ESCOLHIDOS,
        OBRIGACOES_FISCAIS_MODO: "serpro",
        SERPRO_AMBIENTE: "trial",
        SERPRO_CNPJ_ESCRITORIO: "12345678000195",
      }),
    ).rejects.toThrow(/SERPRO_AMBIENTE=trial/);
  });

  it("aceita o trial enquanto o modo serpro está desligado", async () => {
    await expect(
      carregarEnv({ VERCEL_ENV: "production", ...LEITORES_ESCOLHIDOS, SERPRO_AMBIENTE: "trial" }),
    ).resolves.toBeUndefined();
  });
});

describe("env: leitores falsos em Production da Vercel", () => {
  it("recusa LEITURA_CARTAO_MODO=falso, inclusive o padrão herdado", async () => {
    await expect(
      carregarEnv({ VERCEL_ENV: "production", EXTRACAO_CONVENCAO_MODO: "indisponivel" }),
    ).rejects.toThrow(/LEITURA_CARTAO_MODO=falso/);
  });

  it("recusa EXTRACAO_CONVENCAO_MODO=falso, inclusive o padrão herdado", async () => {
    await expect(
      carregarEnv({ VERCEL_ENV: "production", LEITURA_CARTAO_MODO: "indisponivel" }),
    ).rejects.toThrow(/EXTRACAO_CONVENCAO_MODO=falso/);
  });

  it("aceita os dois em indisponivel", async () => {
    await expect(
      carregarEnv({
        VERCEL_ENV: "production",
        LEITURA_CARTAO_MODO: "indisponivel",
        EXTRACAO_CONVENCAO_MODO: "indisponivel",
      }),
    ).resolves.toBeUndefined();
  });

  it("deixa o falso valer fora de Production (dev, CI e Preview)", async () => {
    await expect(carregarEnv({ VERCEL_ENV: "preview" })).resolves.toBeUndefined();
    await expect(carregarEnv({})).resolves.toBeUndefined();
  });
});
