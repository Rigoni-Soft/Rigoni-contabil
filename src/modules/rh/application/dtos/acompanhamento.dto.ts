import type { ContagemDoHolerite } from "@/modules/rh/domain/services/holerite.service";

export type EscopoDoAplica = "aplica" | "mes" | "sempre";

export type ServicoAcompanhamentoDto = {
  id: string;
  nome: string;
  sistema: boolean;
};

type CelulaAcompanhamentoDto = {
  servicoId: string;
  aplica: boolean;
  sempre: boolean;
  concluido: boolean;
};

export type ClienteAcompanhamentoDto = {
  clienteId: string;
  empresa: string;
  cnpj: string;
  naoAplica: string[];
  naoAplicaSempre: string[];
  concluidos: string[];
  responsavel: { id: string; nome: string } | null;
  holerite: ContagemDoHolerite;
};

export type HoleriteDaLinhaDto = ContagemDoHolerite & { exigidos: number };

type LinhaAcompanhamentoDto = {
  clienteId: string;
  empresa: string;
  cnpj: string;
  celulas: CelulaAcompanhamentoDto[];
  holerite: HoleriteDaLinhaDto;
};

export type AcompanhamentoMensalDto = {
  competencia: string;
  servicos: ServicoAcompanhamentoDto[];
  linhas: LinhaAcompanhamentoDto[];
  podeMarcar: boolean;
};

export type FuncionarioAcompanhamentoDto = {
  id: string;
  nome: string;
  atribuidos: number;
  pontos: number;
  faltam: { servicoId: string; nome: string; clientes: number; empresas: string[] }[];
};

type PendenciaDoFuncionarioDto = {
  servicoId: string;
  nome: string;
  clientes: { clienteId: string; empresa: string; cnpj: string }[];
};

export type DetalheDoFuncionarioDto = {
  funcionario: FuncionarioAcompanhamentoDto;
  pendencias: PendenciaDoFuncionarioDto[];
  evolucao: { competencia: string; pontos: number; atribuidos: number }[];
  maisAtrasados: { clienteId: string; empresa: string; cnpj: string; meses: number }[];
};

export type AcompanhamentoFuncionariosDto = {
  competencia: string;
  funcionarios: FuncionarioAcompanhamentoDto[];
  semResponsavel: { clienteId: string; empresa: string; cnpj: string }[];
  detalhe?: DetalheDoFuncionarioDto;
};
