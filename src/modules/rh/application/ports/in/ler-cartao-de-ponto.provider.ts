import type { ImagemDoCartao } from "@/modules/rh/application/ports/out/leitor-de-cartao.provider";
import type { Quinzena } from "@/modules/rh/domain/services/leitura-do-cartao.service";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type LerCartaoDePontoInput = {
  clienteId: string;
  // "AAAA-MM".
  competencia: string;
  quinzena: Quinzena;
  imagem: ImagemDoCartao;
};

export type CartaoLidoDto = {
  empregadoId: string;
  nome: string;
  // O empregado não estava no Quadro e foi cadastrado pelo nome do cartão.
  cadastrado: boolean;
  // Quem leu: o OCR local ou a visão (o custo vem do segundo).
  origem: string;
  dias: number;
  faltas: number;
  abonos: number;
};

export interface LerCartaoDePontoPort {
  execute(input: LerCartaoDePontoInput): Promise<Result<CartaoLidoDto, AppError>>;
}
