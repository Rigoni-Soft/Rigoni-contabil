import type { InterruptoresDoClienteDto } from "@/modules/rh/application/dtos/convencao.dto";
import type {
  DiaDoPontoDto,
  EmpregadoDto,
  ParDto,
} from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type DadosDoEmpregado = { nome: string; jornada: number[]; comissionado: boolean };
export type ClienteDoPontoDto = { cnpj: string; empresa: string; responsavelId: string | null };

// `competencia` é o primeiro dia do mês ("AAAA-MM-01"). O banco (RLS + gatilhos) é a última barreira.
export interface FolhaDePontoRepository {
  // null = cliente inexistente ou fora da vista do ator.
  buscarCliente(clienteId: string): Promise<Result<ClienteDoPontoDto | null, AppError>>;
  // null = empregado inexistente ou fora da vista do ator.
  buscarClienteDoEmpregado(empregadoId: string): Promise<Result<string | null, AppError>>;
  listarEmpregados(clienteId: string): Promise<Result<EmpregadoDto[], AppError>>;
  // Ids dos empregados do Cliente sem movimento no mês.
  listarSemMovimento(clienteId: string, competencia: string): Promise<Result<string[], AppError>>;
  buscarPadraoComissionados(clienteId: string): Promise<Result<boolean, AppError>>;
  definirPadraoComissionados(clienteId: string, valor: boolean): Promise<Result<void, AppError>>;
  cadastrarEmpregado(clienteId: string, dados: DadosDoEmpregado): Promise<Result<void, AppError>>;
  corrigirEmpregado(id: string, dados: DadosDoEmpregado): Promise<Result<void, AppError>>;
  definirAtivo(id: string, ativo: boolean): Promise<Result<void, AppError>>;
  definirSemMovimento(
    empregadoId: string,
    competencia: string,
    sem: boolean,
  ): Promise<Result<void, AppError>>;
  listarDias(
    empregadoId: string,
    de: string,
    ate: string,
  ): Promise<Result<DiaDoPontoDto[], AppError>>;
  // Dia sem batidas, sem Extra e sem Abono apaga a linha.
  salvarDia(
    empregadoId: string,
    dia: { data: string; batidas: ParDto[]; extra: ParDto | null; abono: boolean },
  ): Promise<Result<void, AppError>>;
  listarFeriados(de: string, ate: string): Promise<Result<string[], AppError>>;
  buscarInterruptores(clienteId: string): Promise<Result<InterruptoresDoClienteDto, AppError>>;
  definirInterruptores(
    clienteId: string,
    interruptores: InterruptoresDoClienteDto,
  ): Promise<Result<void, AppError>>;
  // Sindicato da convenção que cada empregado do Cliente segue (nulo = a única do Cliente).
  listarConvencaoDosEmpregados(
    clienteId: string,
  ): Promise<Result<{ empregadoId: string; sindicato: string | null }[], AppError>>;
  definirConvencaoDoEmpregado(
    empregadoId: string,
    sindicato: string | null,
  ): Promise<Result<void, AppError>>;
}
