import type { RegistroAcaoDto } from "@/modules/auditoria/application/dtos/registro-acao.dto";
import type {
  ListarRegistrosInput,
  ListarRegistrosPort,
} from "@/modules/auditoria/application/ports/in/listar-registros.provider";
import type { RegistroAcaoRepository } from "@/modules/auditoria/application/ports/out/registro-acao.repository";
import type { SessaoPort } from "@/modules/auditoria/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, type Result } from "@/shared/kernel/result";

const LIMITE_FEED = 50;

// Timezone de negócio fixo (América/São Paulo, UTC-3 desde o fim do horário de
// verão em 2019): offset literal é determinístico em browser/servidor/CI sem
// Intl. O filtro por período calcula os limites do dia no mesmo fuso que
// feed.presenter.ts usa pra exibir — do contrário um registro perto da
// meia-noite aparece num dia na tela e é filtrado como se fosse de outro.
const OFFSET_SAO_PAULO = "-03:00";

function inicioDoDia(data: string): string {
  return new Date(`${data}T00:00:00.000${OFFSET_SAO_PAULO}`).toISOString();
}

function fimDoDia(data: string): string {
  return new Date(`${data}T23:59:59.999${OFFSET_SAO_PAULO}`).toISOString();
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

    return this.registros.listar({
      limite: LIMITE_FEED,
      setor: input.setor,
      ator: input.ator,
      acao: input.acao,
      alvo: input.alvo,
      resultado: input.resultado,
      dataInicio: input.dataInicio ? inicioDoDia(input.dataInicio) : undefined,
      dataFim: input.dataFim ? fimDoDia(input.dataFim) : undefined,
    });
  }
}
