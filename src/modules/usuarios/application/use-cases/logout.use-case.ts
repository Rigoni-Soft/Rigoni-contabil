import type { LogoutPort } from "@/modules/usuarios/application/ports/in/logout.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";

export class Logout implements LogoutPort {
  constructor(private readonly sessao: SessaoPort) {}

  async execute(): Promise<void> {
    await this.sessao.encerrar();
  }
}
