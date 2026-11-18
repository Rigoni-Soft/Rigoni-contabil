import { FalhaTecnica, montar, usuario } from "../../../../../test-support/montar-avatar";

describe("RemoverAvatar", () => {
  const comFoto = [usuario("func-1", "funcionario", { avatar: "2026-11-01T10:00:00Z" })];

  it("apaga o objeto antes de zerar a coluna e audita", async () => {
    const { remover, chamadas, auditorias } = montar({ perfis: comFoto });

    const r = await remover.execute();

    expect(r.ok).toBe(true);
    expect(chamadas).toEqual(["apagar:func-1", "definir:func-1:null"]);
    expect(auditorias).toEqual([
      { acao: "perfil.avatar.remover", resultado: "sucesso", alvo: "func-1@rigonicontabil.local" },
    ]);
  });

  it("sem foto na coluna só apaga o objeto (órfão), sem zerar a coluna nem auditar", async () => {
    const { remover, chamadas, auditorias } = montar();

    expect((await remover.execute()).ok).toBe(true);
    expect(chamadas).toEqual(["apagar:func-1"]);
    expect(auditorias).toEqual([]);
  });

  it("se apagar falha, a coluna continua preenchida (e a operação se repete)", async () => {
    const { remover, chamadas, falhas } = montar({ perfis: comFoto });
    falhas.apagar = new FalhaTecnica("storage fora");

    const r = await remover.execute();

    expect(r.ok).toBe(false);
    expect(chamadas).toEqual(["apagar:func-1"]);

    falhas.apagar = undefined;
    expect((await remover.execute()).ok).toBe(true);
    expect(chamadas).toEqual(["apagar:func-1", "apagar:func-1", "definir:func-1:null"]);
  });

  it("se zerar a coluna falha, pede para repetir", async () => {
    const { remover, falhas } = montar({ perfis: comFoto });
    falhas.definir = new FalhaTecnica("banco fora");

    const r = await remover.execute();

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("INCONSISTENT_STATE");
  });

  it("recusa sem sessão", async () => {
    const { remover, chamadas } = montar({ atorId: null });

    expect((await remover.execute()).ok).toBe(false);
    expect(chamadas).toEqual([]);
  });
});
