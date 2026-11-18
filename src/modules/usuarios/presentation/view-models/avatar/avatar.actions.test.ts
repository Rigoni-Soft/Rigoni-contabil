/**
 * Integração presentation ↔ application: o `main` é substituído por portas falsas (testes.md, seção 3).
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { enviarAvatarAction, removerAvatarAction } from "./avatar.actions";

const enviarMock = jest.fn();
const removerMock = jest.fn();

jest.mock("@/main/usuarios.factory", () => ({
  makeEnviarAvatar: () => ({ execute: enviarMock }),
  makeRemoverAvatar: () => ({ execute: removerMock }),
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

function formComFoto(conteudo: number[]): FormData {
  const formData = new FormData();
  formData.set("foto", new File([new Uint8Array(conteudo)], "foto.webp", { type: "image/webp" }));
  return formData;
}

describe("enviarAvatarAction (integração)", () => {
  beforeEach(() => {
    enviarMock.mockReset();
    removerMock.mockReset();
  });

  it("sem arquivo devolve VALIDATION_ERROR sem chamar o caso de uso", async () => {
    const resultado = await enviarAvatarAction(new FormData());

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("VALIDATION_ERROR");
    expect(enviarMock).not.toHaveBeenCalled();
  });

  it("repassa os bytes do arquivo ao caso de uso e devolve a data da gravação", async () => {
    enviarMock.mockResolvedValue(ok({ avatarAtualizadoEm: "2026-11-18T10:00:00.000Z" }));

    const resultado = await enviarAvatarAction(formComFoto([1, 2, 3]));

    expect(resultado).toEqual({
      ok: true,
      data: { avatarAtualizadoEm: "2026-11-18T10:00:00.000Z" },
    });
    expect([...enviarMock.mock.calls[0][0].bytes]).toEqual([1, 2, 3]);
  });

  it("devolve o erro do caso de uso", async () => {
    enviarMock.mockResolvedValue(err(new ForbiddenError("Sessão inválida.")));

    const resultado = await enviarAvatarAction(formComFoto([1]));

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("FORBIDDEN");
  });
});

describe("removerAvatarAction (integração)", () => {
  beforeEach(() => removerMock.mockReset());

  it("devolve sucesso do caso de uso", async () => {
    removerMock.mockResolvedValue(ok(undefined));

    expect((await removerAvatarAction()).ok).toBe(true);
  });

  it("devolve o erro do caso de uso", async () => {
    removerMock.mockResolvedValue(err(new ForbiddenError("Sessão inválida.")));

    const resultado = await removerAvatarAction();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("FORBIDDEN");
  });
});
