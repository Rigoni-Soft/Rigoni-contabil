import type { ContatoProps } from "@/modules/clientes/domain/value-objects/contato.vo";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

type ContatoInput = ContatoProps;

type AtividadeMensalInput = { industria: boolean; comercio: boolean; servico: boolean };

export type EditarCadastroOperacionalClienteInput = {
  clienteId: string;
  formaEnvio: string;
  contatos: ContatoInput[];
  documentoObrigatorio: string | null;
  dasStatus: string | null;
  dataEnvioDas: string | null;
  observacoesGerais: string;
  atividadeMes: AtividadeMensalInput;
};

export type EditarCadastroOperacionalClienteOutput = { clienteId: string };

export interface EditarCadastroOperacionalClientePort {
  execute(
    input: EditarCadastroOperacionalClienteInput,
  ): Promise<Result<EditarCadastroOperacionalClienteOutput, AppError>>;
}
