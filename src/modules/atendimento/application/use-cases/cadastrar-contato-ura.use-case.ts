import type {
  CadastrarContatoUraPort,
  CadastroContatoUraInput,
  ResultadoCadastroContatoUra,
} from "@/modules/atendimento/application/ports/in/cadastrar-contato-ura.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { ContatoUraPort } from "@/modules/atendimento/application/ports/out/contato-ura.provider";
import type { SessaoPort } from "@/modules/atendimento/application/ports/out/sessao.provider";
import {
  normalizarEmailDoContato,
  podeCadastrarContatoUra,
} from "@/modules/atendimento/domain/services/contato-ura.service";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, type Result } from "@/shared/kernel/result";

// O número do Atendimento vira Contato do Cliente que a Recepção confirmou. A permissão é só esta:
// criar um Contato (setor URA, Recepção dona); nenhum Contato nem Destino de outro Setor é tocado.
export class CadastrarContatoUra implements CadastrarContatoUraPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly contatos: ContatoUraPort,
  ) {}

  async execute(
    input: CadastroContatoUraInput,
  ): Promise<Result<ResultadoCadastroContatoUra, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para cadastrar o contato."));

    const encontrado = await this.repositorio.buscarEmAndamento(input.atendimentoId);
    if (!encontrado.ok) return encontrado;
    if (!encontrado.value) return err(new NotFoundError("Atendimento não encontrado."));
    if (!podeCadastrarContatoUra(ator, encontrado.value)) {
      return err(new ForbiddenError("Só o dono do Atendimento da Recepção cadastra contato."));
    }

    const nome = input.nome.trim();
    if (nome === "") return err(new ValidationError("Informe o nome do contato."));
    const email = normalizarEmailDoContato(input.email);
    if (email === undefined) return err(new ValidationError("Informe um e-mail válido."));

    return this.contatos.cadastrar({
      atendimentoId: input.atendimentoId,
      clienteId: input.clienteId,
      nome,
      email,
    });
  }
}
