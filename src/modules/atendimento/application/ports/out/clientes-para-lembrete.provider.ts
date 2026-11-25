import type { AppError } from "@/shared/errors/app.error";
import type { DasStatusValor } from "@/shared/kernel/das-status";
import type { DocumentoObrigatorioStatusValor } from "@/shared/kernel/documento-obrigatorio-status";
import type { Result } from "@/shared/kernel/result";

export type ClienteParaLembrete = {
  clienteId: string;
  empresa: string;
  documentoObrigatorio: DocumentoObrigatorioStatusValor | null;
  dasStatus: DasStatusValor | null;
  dataEnvioDas: string | null;
};

export type DasDoCliente = {
  dasStatus: DasStatusValor | null;
  dataEnvioDas: string | null;
  caminhoGuiaDas: string | null;
};

export interface ClientesParaLembretePort {
  listar(): Promise<Result<ClienteParaLembrete[], AppError>>;
  obterDas(clienteId: string): Promise<Result<DasDoCliente | null, AppError>>;
  reservarDas(clienteId: string): Promise<Result<string | null, AppError>>;
  concluirDas(
    clienteId: string,
    token: string,
    dataIso: string,
    caminho: string,
  ): Promise<Result<boolean, AppError>>;
  liberarDas(clienteId: string, token: string): Promise<Result<void, AppError>>;
}
