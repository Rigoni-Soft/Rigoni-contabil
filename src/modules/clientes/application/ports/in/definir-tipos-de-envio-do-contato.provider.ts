import type { AppError } from "@/shared/errors/app.error";
import type { FormaEnvioValor } from "@/shared/kernel/forma-envio";
import type { Result } from "@/shared/kernel/result";

export type DefinirTiposDeEnvioDoContatoInput = {
  clienteId: string;
  contatoId: string;
  // Os tipos do catálogo do Setor (ou "todos") que este contato recebe; vazio = nenhum.
  tipos: string[];
  // Por onde o Setor envia quando o contato tem os dois canais (sem padrão: o banco exige a escolha);
  // com um canal só, o canal é o do contato e este valor é ignorado.
  canal?: FormaEnvioValor;
};

export interface DefinirTiposDeEnvioDoContatoPort {
  execute(input: DefinirTiposDeEnvioDoContatoInput): Promise<Result<void, AppError>>;
}
