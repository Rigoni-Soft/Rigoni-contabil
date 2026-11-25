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

export interface FolhaDePontoRepository {
  buscarCliente(clienteId: string): Promise<Result<ClienteDoPontoDto | null, AppError>>;
  buscarClienteDoEmpregado(empregadoId: string): Promise<Result<string | null, AppError>>;
  listarEmpregados(clienteId: string): Promise<Result<EmpregadoDto[], AppError>>;
  listarSemMovimento(clienteId: string, competencia: string): Promise<Result<string[], AppError>>;
  cartaoIniciado(empregadoId: string, competencia: string): Promise<Result<boolean, AppError>>;
  iniciarCartao(empregadoId: string, competencia: string): Promise<Result<void, AppError>>;
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
  salvarDia(
    empregadoId: string,
    dia: { data: string; batidas: ParDto[]; extra: ParDto | null; abono: boolean },
  ): Promise<Result<void, AppError>>;
  gravarCartao(
    empregadoId: string,
    competencia: string,
    dias: { data: string; batidas: ParDto[]; extra: ParDto | null; abono: boolean }[],
  ): Promise<Result<void, AppError>>;
  abonarDias(empregadoId: string, datas: string[]): Promise<Result<void, AppError>>;
  listarFeriados(de: string, ate: string): Promise<Result<string[], AppError>>;
  buscarInterruptores(clienteId: string): Promise<Result<InterruptoresDoClienteDto, AppError>>;
  definirInterruptores(
    clienteId: string,
    interruptores: InterruptoresDoClienteDto,
  ): Promise<Result<void, AppError>>;
  listarConvencaoDosEmpregados(
    clienteId: string,
  ): Promise<Result<{ empregadoId: string; sindicato: string | null }[], AppError>>;
  definirConvencaoDoEmpregado(
    empregadoId: string,
    sindicato: string | null,
  ): Promise<Result<void, AppError>>;
}
