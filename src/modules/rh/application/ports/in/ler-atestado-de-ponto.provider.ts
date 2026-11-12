import type { ImagemDoCartao } from "@/modules/rh/application/ports/out/leitor-de-cartao.provider";
import type { TipoDeAtestado } from "@/modules/rh/domain/services/atestado.service";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type LerAtestadoDePontoInput = { clienteId: string; imagem: ImagemDoCartao };

export type AtestadoLidoDto = {
  nome: string;
  tipo: TipoDeAtestado;
  // Dias que ganharam Abono; 0 = o RH confere (ex.: declaração em dia sem batida).
  abonados: number;
};

export interface LerAtestadoDePontoPort {
  execute(input: LerAtestadoDePontoInput): Promise<Result<AtestadoLidoDto, AppError>>;
}
