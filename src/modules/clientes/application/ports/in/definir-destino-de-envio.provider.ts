import type { ContatoDoDestino } from "@/modules/clientes/domain/value-objects/destino-de-envio.vo";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type DefinirDestinoDeEnvioInput = {
  clienteId: string;
  contato: ContatoDoDestino;
  // null = "todos os envios do Setor".
  tipo: string | null;
  canal: string;
};

export interface DefinirDestinoDeEnvioPort {
  // Define um Destino do Setor de quem chama; devolve o id do Destino e o do Contato (novo ou escolhido).
  execute(
    input: DefinirDestinoDeEnvioInput,
  ): Promise<Result<{ destinoId: string; contatoId: string }, AppError>>;
}
