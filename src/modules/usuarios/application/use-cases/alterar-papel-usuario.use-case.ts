import type {
  AlterarPapelUsuarioInput,
  AlterarPapelUsuarioPort,
} from "@/modules/usuarios/application/ports/in/alterar-papel-usuario.provider";
import {
  ORIENTACAO_SETOR_COM_LIDER,
  type AlteracaoPapelPort,
} from "@/modules/usuarios/application/ports/out/alteracao-papel.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import { exigirAdmin } from "@/modules/usuarios/application/use-cases/exigir-admin.use-case";
import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, type Result } from "@/shared/kernel/result";

export class AlterarPapelUsuario implements AlterarPapelUsuarioPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly usuarios: UsuarioRepository,
    private readonly alteracao: AlteracaoPapelPort,
  ) {}

  async execute({ usuarioId, papel }: AlterarPapelUsuarioInput): Promise<Result<void, AppError>> {
    const ator = await exigirAdmin(
      this.sessao,
      this.usuarios,
      "Só Admin altera o papel de usuários.",
    );
    if (!ator.ok) return ator;

    if (papel !== "lider_setor" && papel !== "funcionario") {
      return err(new ValidationError("Papel inválido: só Líder de setor ou Funcionário."));
    }
    if (usuarioId === ator.value.id) {
      return err(new ForbiddenError("Você não pode alterar o próprio papel."));
    }
    const alvo = await this.usuarios.buscarPorId(usuarioId as UsuarioId);
    if (!alvo.ok) return alvo;
    if (!alvo.value) return err(new ValidationError("Usuário não encontrado."));
    if (alvo.value.papel.ehAdmin()) {
      return err(new ForbiddenError("O papel de Admin não pode ser alterado."));
    }
    if (alvo.value.estaDesativado()) {
      return err(new ValidationError("Usuário desativado não pode mudar de papel."));
    }
    if (alvo.value.papel.valor === papel) {
      return err(new ValidationError("O usuário já tem esse papel."));
    }

    // Dois passos explícitos (#57): nunca troca o Líder atual por baixo. A mesma
    // regra é garantida no banco (índice único parcial), que fecha a corrida.
    if (papel === "lider_setor") {
      const lider = await this.usuarios.buscarLiderAtivoDoSetor(alvo.value.setor);
      if (!lider.ok) return lider;
      if (lider.value) {
        return err(
          new ValidationError(
            `O setor já tem Líder ativo (${lider.value.nome}). ${ORIENTACAO_SETOR_COM_LIDER}`,
          ),
        );
      }
    }

    return this.alteracao.alterar(alvo.value.id, ator.value.id, papel);
  }
}
