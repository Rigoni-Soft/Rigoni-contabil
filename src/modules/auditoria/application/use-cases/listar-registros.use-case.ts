import type { RegistroAcaoDto } from "@/modules/auditoria/application/dtos/registro-acao.dto";
import type {
  ListarRegistrosInput,
  ListarRegistrosPort,
} from "@/modules/auditoria/application/ports/in/listar-registros.provider";
import type { RegistroAcaoRepository } from "@/modules/auditoria/application/ports/out/registro-acao.repository";
import type { SessaoPort } from "@/modules/auditoria/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const LIMITE_FEED = 50;

function inicioDoDia(data: string): string {
  return `${data}T00:00:00.000Z`;
}

function fimDoDia(data: string): string {
  return `${data}T23:59:59.999Z`;
}

export class ListarRegistros implements ListarRegistrosPort {
  constructor(
    private readonly registros: RegistroAcaoRepository,
    private readonly sessao: SessaoPort,
  ) {}

  async execute(input: ListarRegistrosInput = {}): Promise<Result<RegistroAcaoDto[], AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || ator.papel !== "admin") {
      return err(new ForbiddenError("Só Admin acessa o feed de auditoria."));
    }

    return ok(
      await this.registros.listar({
        limite: LIMITE_FEED,
        setor: input.setor,
        ator: input.ator,
        acao: input.acao,
        alvo: input.alvo,
        resultado: input.resultado,
        dataInicio: input.dataInicio ? inicioDoDia(input.dataInicio) : undefined,
        dataFim: input.dataFim ? fimDoDia(input.dataFim) : undefined,
      }),
    );
  }
}
