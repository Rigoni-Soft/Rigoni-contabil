import type { ImagemDoCartao } from "@/modules/rh/application/ports/out/leitor-de-cartao.provider";
import type { Quinzena } from "@/modules/rh/domain/services/leitura-do-cartao.service";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type LerCartaoDePontoInput = {
  clienteId: string;
  competencia: string;
  quinzena: Quinzena;
  imagem: ImagemDoCartao;
};

export type CartaoLidoDto = {
  empregadoId: string;
  nome: string;
  cadastrado: boolean;
  dias: number;
  mantidos: number;
  faltas: number;
  abonos: number;
};

export interface LerCartaoDePontoPort {
  execute(input: LerCartaoDePontoInput): Promise<Result<CartaoLidoDto, AppError>>;
}
