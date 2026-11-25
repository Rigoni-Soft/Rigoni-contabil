import type {
  EditarCadastroRhClienteInput,
  EditarCadastroRhClientePort,
} from "@/modules/clientes/application/ports/in/editar-cadastro-rh-cliente.provider";
import type { CadastroRhRepository } from "@/modules/clientes/application/ports/out/cadastro-rh.repository";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { Contato } from "@/modules/clientes/domain/value-objects/contato.vo";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { podeEditarCadastroRh } from "@/shared/kernel/papeis";
import { err, ok, type Result } from "@/shared/kernel/result";

export class EditarCadastroRhCliente implements EditarCadastroRhClientePort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: CadastroRhRepository,
  ) {}

  async execute(
    input: EditarCadastroRhClienteInput,
  ): Promise<Result<{ clienteId: string }, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || !podeEditarCadastroRh(ator.papel, ator.setor)) {
      return err(new ForbiddenError("Só o RH (e o Admin) edita o cadastro do RH."));
    }

    for (const contato of input.contatos ?? []) {
      const valido = Contato.criar(contato);
      if (!valido.ok) return valido;
    }

    const salvo = await this.repositorio.atualizar(
      input.clienteId,
      input.observacoes,
      input.contatos,
    );
    return salvo.ok ? ok({ clienteId: input.clienteId }) : salvo;
  }
}
