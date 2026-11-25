import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { err, ok } from "@/shared/kernel/result";

import { GET } from "./servir-avatar.webhook";

const executeMock = jest.fn();

jest.mock("@/main/usuarios.factory", () => ({
  makeObterAvatar: () => ({ execute: executeMock }),
}));

describe("GET /api/avatar (integração)", () => {
  beforeEach(() => executeMock.mockReset());

  it("serve a foto como WebP com Cache-Control private", async () => {
    executeMock.mockResolvedValue(ok(new Uint8Array([1, 2, 3])));

    const resposta = await GET();

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("Content-Type")).toBe("image/webp");
    expect(resposta.headers.get("Cache-Control")).toMatch(/^private/);
    expect(resposta.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect([...new Uint8Array(await resposta.arrayBuffer())]).toEqual([1, 2, 3]);
  });

  it("não repassa id nem parâmetro ao caso de uso: só a sessão decide de quem é a foto", async () => {
    executeMock.mockResolvedValue(ok(new Uint8Array([1])));

    await GET();

    expect(executeMock).toHaveBeenCalledWith();
  });

  it("sem foto responde 404, sem cache", async () => {
    executeMock.mockResolvedValue(err(new NotFoundError("Sem foto.")));

    const resposta = await GET();

    expect(resposta.status).toBe(404);
    expect(resposta.headers.get("Cache-Control")).toMatch(/no-store/);
  });

  it("sem sessão responde 401", async () => {
    executeMock.mockResolvedValue(err(new ForbiddenError("Sessão inválida.")));

    expect((await GET()).status).toBe(401);
  });
});
