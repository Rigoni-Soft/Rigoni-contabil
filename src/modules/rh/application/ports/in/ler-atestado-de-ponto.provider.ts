import type { ImagemDoCartao } from "@/modules/rh/application/ports/out/leitor-de-cartao.provider";
import type { TipoDeAtestado } from "@/modules/rh/domain/services/atestado.service";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// O atestado é lido a partir do cartão de um empregado: o nome nele precisa conferir com o dele.
export type LerAtestadoDePontoInput = { empregadoId: string; imagem: ImagemDoCartao };

export type AtestadoLidoDto = {
  tipo: TipoDeAtestado;
  // Dias que ganharam Abono (sempre 1 ou mais: sem nada a abonar, o resultado é erro com o motivo).
  abonados: number;
};

export interface LerAtestadoDePontoPort {
  execute(input: LerAtestadoDePontoInput): Promise<Result<AtestadoLidoDto, AppError>>;
}
