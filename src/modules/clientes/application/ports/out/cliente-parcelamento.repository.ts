import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// O que a edição manual grava. O anexo só é gravado quando o Parcelamento nasce.
export type ParcelamentoGravar = {
  id: string;
  codigo: string;
  parcelasRestantes: number;
  interno: boolean;
  arquivoCaminho: string;
};

export type ParcelamentoSalvo = ParcelamentoGravar & {
  // Marcado quitado ou parcelas restantes em zero: decidido só pelo banco.
  quitado: boolean;
  // Algum registro de envio: o Parcelamento não pode mais ser removido.
  temEnvio: boolean;
  // A parcela do mês corrente já tem registro de envio (selo "Enviado"; senão "Pendente").
  enviadoNoMes: boolean;
};

export interface ClienteParcelamentoRepository {
  listar(clienteId: string): Promise<Result<ParcelamentoSalvo[], AppError>>;
  // Substitui o conjunto do Cliente: o que não está em `itens` é removido (recusado se houver envio).
  salvar(clienteId: string, itens: ParcelamentoGravar[]): Promise<Result<void, AppError>>;
}
