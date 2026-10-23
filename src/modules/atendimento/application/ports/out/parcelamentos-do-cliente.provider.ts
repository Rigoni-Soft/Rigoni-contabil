import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ParcelamentoDoCliente = {
  id: string;
  codigo: string;
  interno: boolean;
  valorParcelaCentavos: number | null;
  // Parcelas (AAAAMM) com registro de envio.
  parcelasEnviadas: string[];
};

export interface ParcelamentosDoClientePort {
  // Só os que o banco diz em aberto e com parcelas restantes: quitado ou zerado não volta, e sem
  // nenhum o provedor fiscal não é chamado.
  listarEmAberto(clienteId: string): Promise<Result<ParcelamentoDoCliente[], AppError>>;
  // Grava o registro de envio da parcela, desconta uma parcela restante (quita ao chegar a zero) e
  // audita com a URA como ator, tudo uma vez só por parcelamento e parcela. false: já estava
  // registrado, nada mudou.
  registrarEnvio(parcelamentoId: string, parcela: string): Promise<Result<boolean, AppError>>;
}
