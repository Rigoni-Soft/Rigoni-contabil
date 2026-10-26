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
  // O que conferir quando a guia ficou "a confirmar" ao anexar; só vem na resposta do anexo.
  motivo?: string;
};

// `cnpj` é o do Cliente e `codigo` a conta de negociação do Parcelamento: com o que o PDF é conferido.
export type ParcelamentoDaGuia = {
  clienteId: string;
  origem: OrigemDoParcelamento | null;
  cnpj: string;
  codigo: string;
};

// Tudo passa pela sessão do usuário: a RLS decide quem vê, anexa e confirma; os gatilhos do banco
// recusam competência já enviada, segundo anexo na competência e Parcelamento que não é da PGFN.
export interface GuiaParcelaPgfnRepository {
  // null = não existe ou a RLS o esconde.
  parcelamento(parcelamentoId: string): Promise<Result<ParcelamentoDaGuia | null, AppError>>;
  listar(parcelamentoId: string): Promise<Result<GuiaDaParcela[], AppError>>;
  anexar(parcelamentoId: string, guia: GuiaParcelaPgfnProps): Promise<Result<void, AppError>>;
  confirmar(parcelamentoId: string, competencia: string): Promise<Result<void, AppError>>;
  // O registro dessa competência aponta para esse arquivo (reconciliação de resposta perdida).
  gravada(
    parcelamentoId: string,
    competencia: string,
    arquivoCaminho: string,
  ): Promise<Result<boolean, AppError>>;
}
