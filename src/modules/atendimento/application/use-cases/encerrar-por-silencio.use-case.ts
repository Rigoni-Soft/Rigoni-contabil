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

// Job periódico: encerra o Atendimento em atendimento cujo cliente está há 23h50 sem escrever (a
// Mensagem do Funcionário não reinicia a contagem). Ator = sistema, também fora do expediente. Não
// avisa ninguém: o cliente que voltar abre um Atendimento novo pela URA.
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
    return encerrados.ok ? ok({ encerrados: encerrados.value }) : encerrados;
  }
}
