import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Contrato neutro: `idDaMensagem` é o id da mensagem no provedor (chave da idempotência);
// `midia.id` é o que se troca pelo arquivo.
export type MidiaRecebida = {
  telefone: string;
  idDaMensagem?: string;
  midia: { id: string; mime: string; nome?: string };
  legenda?: string;
};

export interface ReceberMidiaPort {
  execute(midia: MidiaRecebida): Promise<Result<void, AppError>>;
}
