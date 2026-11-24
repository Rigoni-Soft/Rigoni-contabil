import type {
  ClienteAcompanhamentoDto,
  EscopoDoAplica,
  ServicoAcompanhamentoDto,
} from "@/modules/rh/application/dtos/acompanhamento.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ClienteDoAcompanhamentoDto = { cnpj: string; responsavelId: string | null };

export interface AcompanhamentoRepository {
  listarServicos(competencia: string): Promise<Result<ServicoAcompanhamentoDto[], AppError>>;
  listarClientes(
    competencia: string,
    responsavelId: string | null,
    incluirSemResponsavel?: boolean,
  ): Promise<Result<ClienteAcompanhamentoDto[], AppError>>;
  buscarCliente(clienteId: string): Promise<Result<ClienteDoAcompanhamentoDto | null, AppError>>;
  criarServico(nome: string): Promise<Result<void, AppError>>;
  renomearServico(id: string, nome: string): Promise<Result<void, AppError>>;
  desativarServico(id: string): Promise<Result<void, AppError>>;
  definirAplica(
    clienteId: string,
    servicoId: string,
    competencia: string,
    escopo: EscopoDoAplica,
  ): Promise<Result<void, AppError>>;
  marcar(
    clienteId: string,
    servicoId: string,
    competencia: string,
    concluido: boolean,
    atorId: string,
  ): Promise<Result<void, AppError>>;
}
