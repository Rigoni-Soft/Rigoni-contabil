import type { ImagemDoCartao } from "@/modules/rh/application/ports/out/leitor-de-cartao.provider";
import type { TipoDeAtestado } from "@/modules/rh/domain/services/atestado.service";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type LerAtestadoDePontoInput = { empregadoId: string; imagem: ImagemDoCartao };

export type AtestadoLidoDto = {
  tipo: TipoDeAtestado;
  abonados: number;
  semCartao: number;
};

export interface LerAtestadoDePontoPort {
  execute(input: LerAtestadoDePontoInput): Promise<Result<AtestadoLidoDto, AppError>>;
}
