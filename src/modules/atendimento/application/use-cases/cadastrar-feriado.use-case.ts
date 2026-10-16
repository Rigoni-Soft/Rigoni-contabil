import type { FeriadoDto } from "@/modules/atendimento/application/dtos/feriado.dto";
import type { CadastrarFeriadoPort } from "@/modules/atendimento/application/ports/in/gerenciar-feriados.provider";
import type { FeriadoRepositoryPort } from "@/modules/atendimento/application/ports/out/feriado.repository";
import type { SessaoPort } from "@/modules/atendimento/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, type Result } from "@/shared/kernel/result";

// A auditoria (`feriado.cadastrar`) nasce no banco, na mesma transação do INSERT.
export class CadastrarFeriado implements CadastrarFeriadoPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly feriados: FeriadoRepositoryPort,
  ) {}

  async execute({ data, descricao }: FeriadoDto): Promise<Result<void, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (ator?.papel !== "admin") return err(new ForbiddenError("Só o Admin cadastra feriados."));

    const instante = new Date(`${data}T00:00:00Z`);
    const dataValida =
      /^\d{4}-\d{2}-\d{2}$/.test(data) &&
      !Number.isNaN(instante.getTime()) &&
      instante.toISOString().startsWith(data);
    if (!dataValida) return err(new ValidationError("Data inválida."));
    const texto = descricao.trim();
    if (texto.length < 1 || texto.length > 200) {
      return err(new ValidationError("Descrição deve ter de 1 a 200 caracteres."));
    }
    return this.feriados.cadastrar({ data, descricao: texto });
  }
}
