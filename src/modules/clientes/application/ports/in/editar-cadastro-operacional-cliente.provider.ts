import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ContatoInput = { id?: string; nome: string; telefone: string; padrao: boolean };

export type AtividadeMensalInput = { industria: boolean; comercio: boolean; servico: boolean };

export type EditarCadastroOperacionalClienteInput = {
  clienteId: string;
  formaEnvio: string;
  contatos: ContatoInput[];
  documentoObrigatorio: string | null;
  dasStatus: string | null;
  dataEnvioDas: string | null;
  temParcelamento: boolean;
  parcelamentoStatus: string | null;
  observacoesGerais: string;
  atividadeMes: AtividadeMensalInput;
};

export type EditarCadastroOperacionalClienteOutput = { clienteId: string };

export interface EditarCadastroOperacionalClientePort {
  execute(
    input: EditarCadastroOperacionalClienteInput,
  ): Promise<Result<EditarCadastroOperacionalClienteOutput, AppError>>;
}
