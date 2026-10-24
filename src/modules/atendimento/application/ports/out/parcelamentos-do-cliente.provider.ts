import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ParcelamentoDoCliente = {
  id: string;
  codigo: string;
  interno: boolean;
  valorParcelaCentavos: number | null;
  parcelasRestantes: number;
  // Parcelas (AAAAMM) com registro de envio.
  parcelasEnviadas: string[];
};

export interface ParcelamentosDoClientePort {
  // Só os em aberto e com parcelas restantes (o banco manda).
  listarEmAberto(clienteId: string): Promise<Result<ParcelamentoDoCliente[], AppError>>;
  // Registro de envio, desconto de uma parcela restante e auditoria da URA, uma vez só por parcela.
  // false: já registrado, nada mudou.
  registrarEnvio(parcelamentoId: string, parcela: string): Promise<Result<boolean, AppError>>;
}
