import { montar, usuario } from "../../../../../test-support/montar-avatar";

describe("ObterAvatar", () => {
  const comFoto = [usuario("func-1", "funcionario", { avatar: "2026-11-01T10:00:00Z" })];

  it("devolve a foto do próprio usuário da sessão", async () => {
    const { obter, chamadas } = montar({ perfis: comFoto });

    const r = await obter.execute();

    expect(r.ok).toBe(true);
    expect(chamadas).toEqual(["ler:func-1"]);
  });

  it("sem foto devolve NOT_FOUND sem ler o storage", async () => {
    const { obter, chamadas } = montar();

    const r = await obter.execute();

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
    expect(chamadas).toEqual([]);
  });

  it("coluna preenchida mas objeto ausente também é NOT_FOUND", async () => {
    const { obter } = montar({ perfis: comFoto, objeto: null });

    const r = await obter.execute();

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("recusa sem sessão", async () => {
    const { obter } = montar({ atorId: null });

    const r = await obter.execute();

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("FORBIDDEN");
  });
});
