import type { CndDto } from "@/modules/clientes/application/ports/out/certidao-cnd.provider";
import type {
  GuiaDasDto,
  GuiaParcelamentoDto,
} from "@/modules/clientes/application/ports/out/obrigacoes-fiscais.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type BuscarGuiaOutput = {
  das: GuiaDasDto;
  parcelamento: GuiaParcelamentoDto;
  cnd: CndDto;
};

export interface BuscarGuiaPort {
  execute(cnpj: string, regime: string): Promise<Result<BuscarGuiaOutput, AppError>>;
}
