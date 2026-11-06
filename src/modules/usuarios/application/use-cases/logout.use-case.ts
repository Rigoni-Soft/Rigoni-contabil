import type { LogoutPort } from "@/modules/usuarios/application/ports/in/logout.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export class Logout implements LogoutPort {
  constructor(private readonly sessao: SessaoPort) {}

  async execute(): Promise<Result<void, AppError>> {
    return this.sessao.encerrar();
  }
}
