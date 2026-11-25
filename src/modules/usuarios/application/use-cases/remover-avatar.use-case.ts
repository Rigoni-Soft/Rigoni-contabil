import type { RemoverAvatarPort } from "@/modules/usuarios/application/ports/in/remover-avatar.provider";
import type {
  AuditoriaPort,
  RegistrarAcaoAuditoria,
} from "@/modules/usuarios/application/ports/out/auditoria.provider";
import type { AvatarArmazenamentoPort } from "@/modules/usuarios/application/ports/out/avatar-armazenamento.provider";
import type { AvatarMarcaPort } from "@/modules/usuarios/application/ports/out/avatar-marca.provider";
import type { RegistroDeErrosPort } from "@/modules/usuarios/application/ports/out/registro-de-erros.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import { exigirUsuarioAtivo } from "@/modules/usuarios/application/use-cases/exigir-usuario-ativo.use-case";
import type { Usuario } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export class RemoverAvatar implements RemoverAvatarPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly usuarios: UsuarioRepository,
    private readonly armazenamento: AvatarArmazenamentoPort,
    private readonly marca: AvatarMarcaPort,
    private readonly auditoria: AuditoriaPort,
    private readonly erros: RegistroDeErrosPort,
  ) {}

  async execute(): Promise<Result<void, AppError>> {
    const ator = await exigirUsuarioAtivo(this.sessao, this.usuarios);
    if (!ator.ok) return ator;
    const usuario = ator.value;

    const apagada = await this.armazenamento.apagar(usuario.id);
    if (!apagada.ok) {
      await this.auditar(usuario, "falha");
      return apagada;
    }

    if (!usuario.temAvatar()) return ok(undefined);

    const zerada = await this.marca.definir(usuario.id, null);
    if (!zerada.ok) {
      this.erros.registrar(
        `Falha ao zerar a marca da foto removida (id=${usuario.id}):`,
        zerada.error.message,
      );
      await this.auditar(usuario, "falha");
      return err(
        new EstadoInconsistenteError(
          "A foto foi apagada, mas a conclusão falhou. Tente remover de novo.",
          usuario.id,
        ),
      );
    }

    const auditada = await this.auditar(usuario, "sucesso");
    if (!auditada.ok) {
      this.erros.registrar(
        `Falha ao registrar a auditoria da remoção da foto (id=${usuario.id}):`,
        auditada.error.message,
      );
    }
    return ok(undefined);
  }

  private auditar(
    usuario: Usuario,
    resultado: RegistrarAcaoAuditoria["resultado"],
  ): Promise<Result<void, AppError>> {
    return this.auditoria.registrar({
      ator: usuario.id,
      setor: usuario.setor.slug,
      acao: "perfil.avatar.remover",
      alvo: usuario.email,
      resultado,
    });
  }
}
