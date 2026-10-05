import type {
  CndDto,
  GuiaDasDto,
  GuiaParcelamentoDto,
} from "@/modules/clientes/application/ports/out/serpro.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type BuscarGuiaOutput = {
  das: GuiaDasDto;
  parcelamento: GuiaParcelamentoDto;
  cnd: CndDto;
};

export interface BuscarGuiaPort {
  execute(cnpj: string): Promise<Result<BuscarGuiaOutput, AppError>>;
}
