import {
  ascii,
  FalhaTecnica,
  montar,
  usuario,
  webp,
} from "../../../../../test-support/montar-avatar";

describe("EnviarAvatar", () => {
  it("grava o objeto, depois a coluna, e audita sem a imagem", async () => {
    const { enviar, chamadas, auditorias } = montar();

    const r = await enviar.execute({ bytes: webp() });

    expect(r.ok).toBe(true);
    expect(chamadas).toEqual(["gravar:func-1:64", "definir:func-1:data"]);
    expect(auditorias).toEqual([
      { acao: "perfil.avatar.enviar", resultado: "sucesso", alvo: "func-1@rigonicontabil.local" },
    ]);
    if (r.ok) expect(new Date(r.value.avatarAtualizadoEm).getTime()).not.toBeNaN();
  });

  it("trocar a foto grava de novo por cima", async () => {
    const { enviar, chamadas } = montar({
      perfis: [usuario("func-1", "funcionario", { avatar: "2026-11-01T10:00:00Z" })],
    });

    expect((await enviar.execute({ bytes: webp() })).ok).toBe(true);
    expect(chamadas).toEqual(["gravar:func-1:64", "definir:func-1:data"]);
  });

  it.each([
    ["Líder", "lider-1", "lider_setor"],
    ["Admin", "admin-1", "admin"],
  ])("%s também personaliza a própria foto", async (_nome, id, papel) => {
    const { enviar, chamadas } = montar({ atorId: id, perfis: [usuario(id, papel)] });

    expect((await enviar.execute({ bytes: webp() })).ok).toBe(true);
    expect(chamadas).toEqual([`gravar:${id}:64`, `definir:${id}:data`]);
  });

  it("recusa o que não é WebP, sem tocar em nada", async () => {
    const { enviar, chamadas } = montar();

    const r = await enviar.execute({ bytes: new Uint8Array(ascii("GIF89a-----------")) });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("VALIDATION_ERROR");
    expect(chamadas).toEqual([]);
  });

  it("recusa mais de 256 KB", async () => {
    const { enviar, chamadas } = montar();
    const grande = new Uint8Array(256 * 1024 + 1);
    grande.set(ascii("RIFF"), 0);
    grande.set(ascii("WEBP"), 8);

    expect((await enviar.execute({ bytes: grande })).ok).toBe(false);
    expect(chamadas).toEqual([]);
  });

  it.each([
    ["sem sessão", { atorId: null }],
    [
      "desativado",
      {
        perfis: [usuario("func-1", "funcionario", { desativadoEm: "2026-11-01T10:00:00Z" })],
      },
    ],
  ])("recusa %s sem tocar em nada", async (_nome, opcoes) => {
    const { enviar, chamadas } = montar(opcoes);

    const r = await enviar.execute({ bytes: webp() });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("FORBIDDEN");
    expect(chamadas).toEqual([]);
  });

  it("falha ao gravar o objeto não toca na coluna", async () => {
    const { enviar, chamadas, falhas, auditorias } = montar();
    falhas.gravar = new FalhaTecnica("storage fora");

    const r = await enviar.execute({ bytes: webp() });

    expect(r.ok).toBe(false);
    expect(chamadas).toEqual(["gravar:func-1:64"]);
    expect(auditorias[0]?.resultado).toBe("falha");
  });

  it("compensa: se a coluna falha, remove o objeto recém-gravado", async () => {
    const { enviar, chamadas, falhas } = montar();
    falhas.definir = new FalhaTecnica("banco fora");

    const r = await enviar.execute({ bytes: webp() });

    expect(r.ok).toBe(false);
    expect(chamadas).toEqual(["gravar:func-1:64", "definir:func-1:data", "apagar:func-1"]);
  });

  it("com foto anterior, a coluna que falha não apaga o objeto (a coluna ainda aponta para ele)", async () => {
    const { enviar, chamadas, falhas } = montar({
      perfis: [usuario("func-1", "funcionario", { avatar: "2026-11-01T10:00:00Z" })],
    });
    falhas.definir = new FalhaTecnica("banco fora");

    expect((await enviar.execute({ bytes: webp() })).ok).toBe(false);
    expect(chamadas).not.toContain("apagar:func-1");
  });

  it("falha da própria compensação vira estado inconsistente", async () => {
    const { enviar, falhas } = montar();
    falhas.definir = new FalhaTecnica("banco fora");
    falhas.apagar = new FalhaTecnica("storage fora");

    const r = await enviar.execute({ bytes: webp() });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("INCONSISTENT_STATE");
  });

  it("falha na auditoria do sucesso pede nova tentativa", async () => {
    const { enviar, falhas } = montar();
    falhas.auditar = new FalhaTecnica("auditoria fora");

    const r = await enviar.execute({ bytes: webp() });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("INCONSISTENT_STATE");
  });
});
