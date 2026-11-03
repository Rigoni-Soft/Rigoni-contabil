import type { ParcelamentoProps } from "@/modules/clientes/domain/value-objects/parcelamento.vo";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

// O que a edição manual grava. O anexo só é gravado quando o Parcelamento nasce.
export type ParcelamentoSalvo = ParcelamentoProps & {
  // Marcado quitado ou parcelas restantes em zero: decidido só pelo banco.
  quitado: boolean;
  // Algum registro de envio: o Parcelamento não pode mais ser removido.
  temEnvio: boolean;
  // A parcela do mês corrente já tem registro de envio (selo "Enviado"; senão "Pendente").
  enviadoNoMes: boolean;
};

export interface ClienteParcelamentoRepository {
  listar(clienteId: string, setor: SetorSlug): Promise<Result<ParcelamentoSalvo[], AppError>>;
  // Substitui o conjunto do Cliente naquele Setor: o que não está em `itens` é removido (recusado se
  // houver envio). Os Parcelamentos dos outros Setores não são tocados.
  salvar(
    clienteId: string,
    setor: SetorSlug,
    itens: ParcelamentoProps[],
  ): Promise<Result<void, AppError>>;
}
