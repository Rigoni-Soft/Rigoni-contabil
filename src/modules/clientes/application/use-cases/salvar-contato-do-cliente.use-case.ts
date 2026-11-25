import type {
  SalvarContatoDoClienteInput,
  SalvarContatoDoClientePort,
} from "@/modules/clientes/application/ports/in/salvar-contato-do-cliente.provider";
import type { ContatoDoClienteRepository } from "@/modules/clientes/application/ports/out/contato-do-cliente.repository";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { Contato } from "@/modules/clientes/domain/value-objects/contato.vo";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export class SalvarContatoDoCliente implements SalvarContatoDoClientePort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: ContatoDoClienteRepository,
  ) {}

  async execute(input: SalvarContatoDoClienteInput): Promise<Result<{ id: string }, AppError>> {
    if (!(await this.sessao.usuarioAtual())) {
      return err(new ForbiddenError("Entre para salvar o contato."));
    }
    const valido = Contato.criar(input.contato);
    if (!valido.ok) return valido;

    const { id, nome, telefone, email } = valido.value;
    const salvo = await this.repositorio.salvar(input.clienteId, { id, nome, telefone, email });
    return salvo.ok ? ok({ id: salvo.value }) : salvo;
  }
}
