import { limparClientesDoE2E } from "./limpeza-e2e";

const LOCAL = "http://127.0.0.1:54321";
const REMOTO = "https://banco-remoto.example.invalid";
const CNPJS = ["11444777000161", "11222333000181"];

describe("limparClientesDoE2E", () => {
  it("com BASE_URL definida não toca no banco (o deploy não é da suíte)", async () => {
    const remover = jest.fn();

    await limparClientesDoE2E({
      baseUrl: "https://preview.example.invalid",
      supabaseUrl: REMOTO,
      cnpjs: CNPJS,
      remover,
    });

    expect(remover).not.toHaveBeenCalled();
  });

  it("sem BASE_URL e com Supabase remoto falha antes de qualquer exclusão", async () => {
    const remover = jest.fn();

    await expect(
      limparClientesDoE2E({ baseUrl: undefined, supabaseUrl: REMOTO, cnpjs: CNPJS, remover }),
    ).rejects.toThrow(/local/i);

    expect(remover).not.toHaveBeenCalled();
  });

  it("sem BASE_URL e com Supabase local apaga só os CNPJs registrados", async () => {
    const remover = jest.fn().mockResolvedValue(undefined);

    await limparClientesDoE2E({ baseUrl: undefined, supabaseUrl: LOCAL, cnpjs: CNPJS, remover });

    expect(remover).toHaveBeenCalledWith(CNPJS);
  });

  it("sem nada registrado não apaga nada", async () => {
    const remover = jest.fn();

    await limparClientesDoE2E({ baseUrl: undefined, supabaseUrl: LOCAL, cnpjs: [], remover });

    expect(remover).not.toHaveBeenCalled();
  });

  describe("zerarAvisos (backlog de Avisos de cadastro)", () => {
    it("Supabase local: zera, mesmo sem nada registrado para apagar", async () => {
      const zerarAvisos = jest.fn().mockResolvedValue(undefined);

      await limparClientesDoE2E({
        baseUrl: undefined,
        supabaseUrl: LOCAL,
        cnpjs: [],
        remover: jest.fn(),
        zerarAvisos,
      });

      expect(zerarAvisos).toHaveBeenCalledTimes(1);
    });

    it("com BASE_URL definida não zera (o deploy não é da suíte)", async () => {
      const zerarAvisos = jest.fn();

      await limparClientesDoE2E({
        baseUrl: "https://preview.example.invalid",
        supabaseUrl: REMOTO,
        cnpjs: CNPJS,
        remover: jest.fn(),
        zerarAvisos,
      });

      expect(zerarAvisos).not.toHaveBeenCalled();
    });

    it("Supabase remoto falha antes de zerar", async () => {
      const zerarAvisos = jest.fn();

      await expect(
        limparClientesDoE2E({
          baseUrl: undefined,
          supabaseUrl: REMOTO,
          cnpjs: CNPJS,
          remover: jest.fn(),
          zerarAvisos,
        }),
      ).rejects.toThrow(/local/i);

      expect(zerarAvisos).not.toHaveBeenCalled();
    });
  });
});
