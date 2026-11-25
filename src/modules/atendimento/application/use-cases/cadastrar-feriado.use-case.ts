import type { FeriadoDto } from "@/modules/atendimento/application/dtos/feriado.dto";
import type { CadastrarFeriadoPort } from "@/modules/atendimento/application/ports/in/gerenciar-feriados.provider";
import type { FeriadoRepositoryPort } from "@/modules/atendimento/application/ports/out/feriado.repository";
import type { SessaoPort } from "@/modules/atendimento/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, type Result } from "@/shared/kernel/result";

const DESCRICAO_MINIMA = 1;
const DESCRICAO_MAXIMA = 200;

function ehDataIsoReal(data: string): boolean {
  const instante = new Date(`${data}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(data) &&
    !Number.isNaN(instante.getTime()) &&
    instante.toISOString().startsWith(data)
  );
}

export class CadastrarFeriado implements CadastrarFeriadoPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly feriados: FeriadoRepositoryPort,
  ) {}

  async execute({ data, descricao }: FeriadoDto): Promise<Result<void, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (ator?.papel !== "admin") return err(new ForbiddenError("Só o Admin cadastra feriados."));

    if (!ehDataIsoReal(data)) return err(new ValidationError("Data inválida."));
    const texto = descricao.trim();
    if (texto.length < DESCRICAO_MINIMA || texto.length > DESCRICAO_MAXIMA) {
      return err(
        new ValidationError(
          `Descrição deve ter de ${DESCRICAO_MINIMA} a ${DESCRICAO_MAXIMA} caracteres.`,
        ),
      );
    }
    return this.feriados.cadastrar({ data, descricao: texto });
  }
}
