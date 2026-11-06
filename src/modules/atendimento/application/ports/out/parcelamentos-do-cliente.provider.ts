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

// Guia já entregue a um acordo do Cliente (em aberto ou quitado): prende o documento ao acordo.
// `identidade` nula: envio anterior à identidade, não se sabe qual guia foi.
export type GuiaEntregue = {
  parcelamentoId: string;
  parcela: string;
  identidade: string | null;
  // PDF entregue no envio aceito; null no registro anterior ao caminho guardado.
  caminho: string | null;
};

// `ja_registrado`: a parcela já tinha registro, nada mudou. `nao_elegivel`: o parcelamento não está
// mais em aberto (quitado, zerado ou removido), nada mudou.
export type EnvioRegistrado = "registrado" | "ja_registrado" | "nao_elegivel";

export interface ParcelamentosDoClientePort {
  // Só os em aberto e com parcelas restantes (o banco manda).
  listarEmAberto(clienteId: string): Promise<Result<ParcelamentoDoCliente[], AppError>>;
  // Quantos parcelamentos comuns o Cliente tem, em aberto ou quitados: separa "nenhum" de "todos
  // quitados" na resposta da URA.
  contarComuns(clienteId: string): Promise<Result<number, AppError>>;
  // Guias já entregues a qualquer acordo do Cliente, quitado ou não, inclusive as sem identidade.
  guiasEntregues(clienteId: string): Promise<Result<GuiaEntregue[], AppError>>;
  // Registro de envio, desconto de uma parcela restante e auditoria da URA, uma vez só por parcela.
  registrarEnvio(
    parcelamentoId: string,
    parcela: string,
    identidade: string,
    caminho: string,
  ): Promise<Result<EnvioRegistrado, AppError>>;
}
