import type { DocumentoPdfDto } from "@/modules/clientes/application/ports/out/obrigacoes-fiscais.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Contrato neutro (docs/contratos/obrigacoes-fiscais.md): a CND tem fonte própria, separada
// das guias — o provedor, a autenticação e o ritmo (emissão pode demorar) são outros.
export type CndDto = DocumentoPdfDto & { validade: string }; // AAAA-MM-DD

export interface CertidaoCndPort {
  buscarCnd(cnpj: string): Promise<Result<CndDto, AppError>>;
}
