import type { ObterAvatarPort } from "@/modules/usuarios/application/ports/in/obter-avatar.provider";
import type { AvatarArmazenamentoPort } from "@/modules/usuarios/application/ports/out/avatar-armazenamento.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import { exigirUsuarioAtivo } from "@/modules/usuarios/application/use-cases/exigir-usuario-ativo.use-case";
import type { AppError } from "@/shared/errors/app.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export class ObterAvatar implements ObterAvatarPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly usuarios: UsuarioRepository,
    private readonly armazenamento: AvatarArmazenamentoPort,
  ) {}

  async execute(): Promise<Result<Uint8Array, AppError>> {
    const ator = await exigirUsuarioAtivo(this.sessao, this.usuarios);
    if (!ator.ok) return ator;
    if (!ator.value.temAvatar()) return err(new NotFoundError("Sem foto."));

    const lida = await this.armazenamento.ler(ator.value.id);
    if (!lida.ok) return lida;
    if (!lida.value) return err(new NotFoundError("Sem foto."));
    return ok(lida.value);
  }
}
