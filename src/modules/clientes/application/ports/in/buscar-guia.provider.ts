import type { CndDto } from "@/modules/clientes/application/ports/out/certidao-cnd.provider";
import type { GuiaDasDto } from "@/modules/clientes/application/ports/out/obrigacoes-fiscais.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type BuscarGuiaOutput = {
  das: GuiaDasDto;
  cnd: CndDto;
};

export interface BuscarGuiaPort {
  execute(cnpj: string): Promise<Result<BuscarGuiaOutput, AppError>>;
}
