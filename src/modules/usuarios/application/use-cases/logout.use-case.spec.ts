import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import { ok, type Result } from "@/shared/kernel/result";

import { Logout } from "./logout.use-case";

class SessaoFalsa implements SessaoPort {
  encerrada = false;
  async autenticar(): Promise<Result<void, AppError>> {
    return ok(undefined);
  }
  async encerrar(): Promise<void> {
    this.encerrada = true;
  }
  async usuarioAtualId(): Promise<UsuarioId | null> {
    return null;
  }
}

describe("Logout", () => {
  it("encerra a sessão pela porta OUT", async () => {
    const sessao = new SessaoFalsa();

    await new Logout(sessao).execute();

    expect(sessao.encerrada).toBe(true);
  });
});
