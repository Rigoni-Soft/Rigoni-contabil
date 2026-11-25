import type {
  EncerrarPorSilencioPort,
  SilencioEncerrado,
} from "@/modules/atendimento/application/ports/in/encerrar-por-silencio.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { RelogioPort } from "@/modules/atendimento/application/ports/out/relogio.provider";
import {
  corteDoEncerramento,
  URA_ATOR_ID,
} from "@/modules/atendimento/domain/services/encerramento-automatico.service";
import type { AppError } from "@/shared/errors/app.error";
import { ok, type Result } from "@/shared/kernel/result";

export class EncerrarPorSilencio implements EncerrarPorSilencioPort {
  constructor(
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly relogio: RelogioPort,
  ) {}

  async execute(): Promise<Result<SilencioEncerrado, AppError>> {
    const encerrados = await this.repositorio.encerrarSemRespostaDoCliente(
      corteDoEncerramento(this.relogio.agora()),
      URA_ATOR_ID,
    );
    return encerrados.ok ? ok({ encerrados: encerrados.value, falhas: 0 }) : encerrados;
  }
}
