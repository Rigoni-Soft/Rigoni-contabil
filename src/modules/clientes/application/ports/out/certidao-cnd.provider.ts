import type { DocumentoPdfDto } from "@/modules/clientes/application/ports/out/obrigacoes-fiscais.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type CndDto = DocumentoPdfDto & { validade: string };

export interface CertidaoCndPort {
  buscarCnd(cnpj: string): Promise<Result<CndDto, AppError>>;
}
