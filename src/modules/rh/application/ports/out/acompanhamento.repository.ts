import type {
  ClienteAcompanhamentoDto,
  ServicoAcompanhamentoDto,
} from "@/modules/rh/application/dtos/acompanhamento.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ClienteDoAcompanhamentoDto = { cnpj: string; responsavelId: string | null };

// `competencia` é sempre o primeiro dia do mês ("AAAA-MM-01").
export interface AcompanhamentoRepository {
  // Serviços que aparecem na tabela do mês, na ordem das colunas.
  listarServicos(competencia: string): Promise<Result<ServicoAcompanhamentoDto[], AppError>>;
  // Clientes com Responsável do RH (só os de `responsavelId`, se dado) e o que foi marcado no mês.
  listarClientes(
    competencia: string,
    responsavelId: string | null,
    // O Líder e o Admin também veem os clientes sem Responsável.
    incluirSemResponsavel?: boolean,
  ): Promise<Result<ClienteAcompanhamentoDto[], AppError>>;
  // null = cliente inexistente ou fora da vista do ator.
  buscarCliente(clienteId: string): Promise<Result<ClienteDoAcompanhamentoDto | null, AppError>>;
  criarServico(nome: string): Promise<Result<void, AppError>>;
  renomearServico(id: string, nome: string): Promise<Result<void, AppError>>;
  desativarServico(id: string): Promise<Result<void, AppError>>;
  definirAplica(
    clienteId: string,
    servicoId: string,
    aplica: boolean,
  ): Promise<Result<void, AppError>>;
  marcar(
    clienteId: string,
    servicoId: string,
    competencia: string,
    concluido: boolean,
    atorId: string,
  ): Promise<Result<void, AppError>>;
}
