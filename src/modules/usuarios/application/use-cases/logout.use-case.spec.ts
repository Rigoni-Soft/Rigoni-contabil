import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { Logout } from "./logout.use-case";

class SessaoFalsa implements SessaoPort {
  encerrada = false;
  erroAoEncerrar: AppError | null = null;
  async autenticar(): Promise<Result<void, AppError>> {
    return ok(undefined);
  }
  async encerrar(): Promise<Result<void, AppError>> {
    if (this.erroAoEncerrar) return err(this.erroAoEncerrar);
    this.encerrada = true;
    return ok(undefined);
  }
  async usuarioAtualId(): Promise<UsuarioId | null> {
    return null;
  }
}

describe("Logout", () => {
  it("encerra a sessão pela porta OUT", async () => {
    const sessao = new SessaoFalsa();

    const resultado = await new Logout(sessao).execute();

    expect(sessao.encerrada).toBe(true);
    expect(resultado.ok).toBe(true);
  });

  it("propaga a falha quando encerrar a sessão não funciona", async () => {
    const sessao = new SessaoFalsa();
    sessao.erroAoEncerrar = new ForbiddenError("falha ao encerrar");

    const resultado = await new Logout(sessao).execute();

    expect(resultado.ok).toBe(false);
  });
});
