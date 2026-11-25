import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type ParcelamentoDoCliente = {
  id: string;
  codigo: string;
  interno: boolean;
  setor: SetorSlug;
  valorParcelaCentavos: number | null;
  parcelasRestantes: number;
  parcelasEnviadas: string[];
};

export type GuiaEntregue = {
  parcelamentoId: string;
  parcela: string;
  identidade: string | null;
  caminho: string | null;
};

export type EnvioRegistrado = "registrado" | "ja_registrado" | "nao_elegivel";

export interface ParcelamentosDoClientePort {
  listarEmAberto(clienteId: string): Promise<Result<ParcelamentoDoCliente[], AppError>>;
  contarComuns(clienteId: string): Promise<Result<number, AppError>>;
  guiasEntregues(clienteId: string): Promise<Result<GuiaEntregue[], AppError>>;
  registrarEnvio(
    parcelamentoId: string,
    parcela: string,
    identidade: string,
    caminho: string,
  ): Promise<Result<EnvioRegistrado, AppError>>;
}
