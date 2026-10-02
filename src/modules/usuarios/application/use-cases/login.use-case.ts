import type { UsuarioDto } from "@/modules/usuarios/application/dtos/usuario.dto";
import { usuarioParaDto } from "@/modules/usuarios/application/mappers/usuario-para-dto.mapper";
import type { LoginInput, LoginPort } from "@/modules/usuarios/application/ports/in/login.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export class Login implements LoginPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly usuarios: UsuarioRepository,
  ) {}

  async execute({ email, senha }: LoginInput): Promise<Result<UsuarioDto, AppError>> {
    const autenticado = await this.sessao.autenticar(email, senha);
    if (!autenticado.ok) return autenticado;

    const id = await this.sessao.usuarioAtualId();
    if (!id) return this.abortarSessaoOrfa("Sessão inválida após autenticação.");

    const perfil = await this.usuarios.buscarPorId(id);
    // Falha técnica (banco indisponível) e falha de reconstrução de domínio (nome/
    // e-mail inválidos salvos no banco) passam pelo mesmo cleanup que "sem perfil",
    // mas com mensagem própria — não apresentam indisponibilidade como ausência
    // cadastral (devolutiva #55, pontos 01 e 02).
    if (!perfil.ok) {
      return this.abortarSessaoOrfa("Falha ao carregar seu perfil. Tente novamente.", perfil.error);
    }
    if (!perfil.value) return this.abortarSessaoOrfa("Usuário autenticado sem perfil cadastrado.");
    const usuario = perfil.value;

    // #31/ADR 0002: expirada sem troca também bloqueia — Admin recadastra a
    // conta (não há endpoint de "regenerar" ainda, YAGNI até virar pedido real).
    if (usuario.senhaProvisoriaVencida(new Date())) {
      return this.abortarSessaoOrfa("Senha provisória expirada. Peça ao Admin uma nova conta.");
    }

    return ok(usuarioParaDto(usuario));
  }

  // Supabase já autenticou nesse ponto: qualquer falha daqui em diante precisa
  // encerrar a sessão pra não deixá-la órfã. O resultado do próprio encerrar()
  // nunca é descartado — se ele falhar, o log do servidor registra (nunca afirma
  // "sessão encerrada" quando não foi); o navegador só recebe o erro seguro.
  private async abortarSessaoOrfa(
    mensagem: string,
    detalheTecnico?: AppError,
  ): Promise<Result<UsuarioDto, AppError>> {
    if (detalheTecnico) {
      console.error("Falha ao carregar perfil durante login:", detalheTecnico.message);
    }
    const encerrado = await this.sessao.encerrar();
    if (!encerrado.ok) {
      console.error("Falha ao encerrar sessão órfã após login:", encerrado.error.message);
    }
    return err(new ForbiddenError(mensagem));
  }
}
