import type { ParcelamentoSalvo } from "@/modules/clientes/application/ports/out/cliente-parcelamento.repository";
import type { ContatoProps } from "@/modules/clientes/domain/value-objects/contato.vo";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type ParcelamentoDto = Omit<ParcelamentoSalvo, "arquivoCaminho"> & { arquivoNome: string };

type DestinoDto = { id: string; contatoId: string; tipo: string | null; canal: string };
type TipoDeEnvioDto = { slug: string; rotulo: string };
export type DestinosDoSetorDto = { destinos: DestinoDto[]; tiposDeEnvio: TipoDeEnvioDto[] };

export type CadastroOperacionalClienteDto = DestinosDoSetorDto & {
  id: string;
  empresa: string;
  cnpj: string;
  regime: string;
  formaEnvio: string;
  contatos: ContatoProps[];
  documentoObrigatorio: string | null;
  dasStatus: string | null;
  dataEnvioDas: string | null;
  parcelamentos: ParcelamentoDto[];
  observacoesGerais: string;
  atividadeMes: { industria: boolean; comercio: boolean; servico: boolean };
  responsavelId: string | null;
  responsavelNome: string | null;
};

export type CadastroRhClienteDto = SugestaoClienteDto &
  DestinosDoSetorDto & {
    contatos: ContatoProps[];
    observacoes: string;
    parcelamentos: ParcelamentoDto[];
  };

export type ResponsavelOpcaoDto = { id: string; nome: string };

export type SugestaoClienteDto = { id: string; empresa: string; cnpj: string };

export type ParcelamentoDoResumo = {
  codigo: string;
  interno: boolean;
  quitado: boolean;
  enviadoNoMes: boolean;
};

export type ResumoOperacionalRow = {
  clienteId: string;
  empresa: string;
  cnpj: string;
  documentoObrigatorio: string | null;
  dasStatus: string | null;
  parcelamentos: ParcelamentoDoResumo[];
  atividadeMes: { industria: boolean; comercio: boolean; servico: boolean };
  responsavelId: string | null;
  responsavelNome: string | null;
};

export interface ClienteQueryPort {
  buscarCadastroOperacional(
    clienteId: string,
  ): Promise<Result<CadastroOperacionalClienteDto | null, AppError>>;

  buscarCadastroRh(clienteId: string): Promise<Result<CadastroRhClienteDto | null, AppError>>;

  buscarPorTermo(
    termo: string,
    apenasSnMei: boolean,
  ): Promise<Result<SugestaoClienteDto[], AppError>>;

  listarResumoOperacional(): Promise<Result<ResumoOperacionalRow[], AppError>>;

  listarResponsaveisElegiveis(setor: SetorSlug): Promise<Result<ResponsavelOpcaoDto[], AppError>>;

  buscarResponsavelDoSetor(
    clienteId: string,
    setor: SetorSlug,
  ): Promise<Result<ResponsavelOpcaoDto | null, AppError>>;
}
