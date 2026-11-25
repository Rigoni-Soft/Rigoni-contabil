import type {
  EstadoDaGuiaPgfn,
  GuiaParcelaPgfnProps,
} from "@/modules/clientes/domain/value-objects/guia-parcela-pgfn.vo";
import type { OrigemDoParcelamento } from "@/modules/clientes/domain/value-objects/parcelamento.vo";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type GuiaDaParcela = {
  competencia: string;
  contaNegociacao: string;
  estado: EstadoDaGuiaPgfn;
  versao: string;
  motivo?: string;
  enviada?: boolean;
};

export type ParcelamentoDaGuia = {
  clienteId: string;
  origem: OrigemDoParcelamento | null;
  cnpj: string;
  codigo: string;
};

export interface GuiaParcelaPgfnRepository {
  parcelamento(parcelamentoId: string): Promise<Result<ParcelamentoDaGuia | null, AppError>>;
  listar(parcelamentoId: string): Promise<Result<GuiaDaParcela[], AppError>>;
  anexar(
    parcelamentoId: string,
    guia: GuiaParcelaPgfnProps,
    motivo: string | null,
  ): Promise<Result<void, AppError>>;
  confirmar(
    parcelamentoId: string,
    competencia: string,
    versao: string,
  ): Promise<Result<void, AppError>>;
  arquivo(parcelamentoId: string, competencia: string): Promise<Result<string | null, AppError>>;
  substituir(
    parcelamentoId: string,
    competencia: string,
    nova: Pick<GuiaParcelaPgfnProps, "contaNegociacao" | "arquivoCaminho">,
    motivo: string | null,
  ): Promise<Result<void, AppError>>;
  remover(parcelamentoId: string, competencia: string): Promise<Result<void, AppError>>;
  gravada(
    parcelamentoId: string,
    competencia: string,
    arquivoCaminho: string,
  ): Promise<Result<boolean, AppError>>;
}
