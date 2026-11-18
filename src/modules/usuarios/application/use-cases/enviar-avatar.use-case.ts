import type {
  EnviarAvatarInput,
  EnviarAvatarPort,
} from "@/modules/usuarios/application/ports/in/enviar-avatar.provider";
import type { AuditoriaPort } from "@/modules/usuarios/application/ports/out/auditoria.provider";
import type { AvatarArmazenamentoPort } from "@/modules/usuarios/application/ports/out/avatar-armazenamento.provider";
import type { AvatarMarcaPort } from "@/modules/usuarios/application/ports/out/avatar-marca.provider";
import type { RegistroDeErrosPort } from "@/modules/usuarios/application/ports/out/registro-de-erros.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import { exigirUsuarioAtivo } from "@/modules/usuarios/application/use-cases/exigir-usuario-ativo.use-case";
import type { Usuario } from "@/modules/usuarios/domain/entities/usuario.entity";
import { ImagemAvatar } from "@/modules/usuarios/domain/value-objects/imagem-avatar.vo";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export class EnviarAvatar implements EnviarAvatarPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly usuarios: UsuarioRepository,
    private readonly armazenamento: AvatarArmazenamentoPort,
    private readonly marca: AvatarMarcaPort,
    private readonly auditoria: AuditoriaPort,
    private readonly erros: RegistroDeErrosPort,
  ) {}

  async execute({
    bytes,
  }: EnviarAvatarInput): Promise<Result<{ avatarAtualizadoEm: string }, AppError>> {
    const ator = await exigirUsuarioAtivo(this.sessao, this.usuarios);
    if (!ator.ok) return ator;
    const usuario = ator.value;

    const imagem = ImagemAvatar.criar(bytes);
    if (!imagem.ok) return imagem;

    // Objeto primeiro, coluna depois: a coluna só aponta para um objeto que existe.
    const gravada = await this.armazenamento.gravar(usuario.id, imagem.value.bytes);
    if (!gravada.ok) {
      await this.auditar(usuario.id, usuario.setor.slug, usuario.email, "falha");
      return gravada;
    }

    const em = new Date();
    const marcada = await this.marca.definir(usuario.id, em);
    if (!marcada.ok) return this.falharNaMarca(usuario, marcada.error);

    const auditada = await this.auditar(usuario.id, usuario.setor.slug, usuario.email, "sucesso");
    if (!auditada.ok) {
      this.erros.registrar(
        `Falha ao registrar a auditoria do envio da foto (id=${usuario.id}):`,
        auditada.error.message,
      );
      return err(
        new EstadoInconsistenteError(
          "Sua foto foi salva, mas a auditoria da ação falhou. Tente novamente.",
          usuario.id,
        ),
      );
    }
    return ok({ avatarAtualizadoEm: em.toISOString() });
  }

  // A coluna falhou depois de o objeto ser gravado. Sem foto antes, o objeto novo ficaria órfão (a coluna
  // segue nula), então compensa apagando. Com foto antes, o objeto já substituiu o antigo e a coluna ainda
  // aponta para ele: apagar deixaria a coluna apontando para o nada, então o objeto fica e o envio se repete.
  private async falharNaMarca(usuario: Usuario, erro: AppError): Promise<Result<never, AppError>> {
    await this.auditar(usuario.id, usuario.setor.slug, usuario.email, "falha");
    if (usuario.temAvatar()) return err(erro);

    const apagada = await this.armazenamento.apagar(usuario.id);
    if (apagada.ok) return err(erro);

    this.erros.registrar(
      `Falha ao compensar o envio da foto (id=${usuario.id}):`,
      apagada.error.message,
    );
    return err(
      new EstadoInconsistenteError(
        "Não foi possível salvar a foto, e o arquivo enviado ficou sobrando. Tente novamente.",
        usuario.id,
      ),
    );
  }

  private auditar(
    ator: string,
    setor: string,
    alvo: string,
    resultado: "sucesso" | "falha",
  ): Promise<Result<void, AppError>> {
    return this.auditoria.registrar({ ator, setor, acao: "perfil.avatar.enviar", alvo, resultado });
  }
}
