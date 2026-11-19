import type { DestinoDeEnvio } from "@/modules/clientes/domain/value-objects/destino-de-envio.vo";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface DestinoDeEnvioRepository {
  // Grava o Destino do Setor de quem chama (e o Contato novo, na mesma transação); devolve os ids.
  definir(
    clienteId: string,
    destino: DestinoDeEnvio,
  ): Promise<Result<{ destinoId: string; contatoId: string }, AppError>>;
  remover(destinoId: string): Promise<Result<void, AppError>>;
}
