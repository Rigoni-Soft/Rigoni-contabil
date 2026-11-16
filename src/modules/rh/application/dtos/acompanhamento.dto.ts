import type { ContagemDoHolerite } from "@/modules/rh/domain/services/holerite.service";
import type {
  MotivoDoPendente,
  SituacaoDosServicos,
} from "@/modules/rh/domain/services/situacao-dos-servicos.service";

// Onde vale o "se aplica": "aplica" (volta ao padrão), "mes" (não se aplica só na competência) ou "sempre"
// (nunca se aplica a este Cliente, em todos os meses).
export type EscopoDoAplica = "aplica" | "mes" | "sempre";

export type ServicoAcompanhamentoDto = {
  id: string;
  nome: string;
  // Serviço do sistema (Holerite): derivado, nunca marcado à mão.
  sistema: boolean;
};

export type CelulaAcompanhamentoDto = {
  servicoId: string;
  aplica: boolean;
  // Só com `aplica` falso: não se aplica a este Cliente em mês nenhum (e não só neste mês).
  sempre: boolean;
  concluido: boolean;
  // Aplica e não está concluído (regra do módulo de situação dos Serviços), com o porquê.
  pendente: boolean;
  motivoDoPendente?: MotivoDoPendente;
};

export type ClienteAcompanhamentoDto = {
  clienteId: string;
  empresa: string;
  cnpj: string;
  // Responsável do RH; null = cliente sem Responsável.
  responsavel: { id: string; nome: string } | null;
  // Empregados e cartões do mês (a contagem de que sai o Holerite).
  holerite: ContagemDoHolerite;
  // A situação dos Serviços do mês, já decidida pelo módulo de domínio.
  situacao: SituacaoDosServicos;
};

// A contagem do Holerite do Cliente no mês, com os cartões que o mês exige (ativos menos "sem movimento").
export type HoleriteDaLinhaDto = ContagemDoHolerite & { exigidos: number };

export type LinhaAcompanhamentoDto = {
  clienteId: string;
  empresa: string;
  cnpj: string;
  // Uma célula por serviço, na ordem das colunas.
  celulas: CelulaAcompanhamentoDto[];
  holerite: HoleriteDaLinhaDto;
  // Nenhum Serviço aplicável faltando: o Cliente rende ponto ao Responsável.
  ponto: boolean;
};

export type AcompanhamentoMensalDto = {
  competencia: string;
  servicos: ServicoAcompanhamentoDto[];
  linhas: LinhaAcompanhamentoDto[];
  // O Funcionário do RH marca os seus; o Líder e o Admin só leem.
  podeMarcar: boolean;
};

export type FuncionarioAcompanhamentoDto = {
  id: string;
  nome: string;
  atribuidos: number;
  // Clientes com todo serviço aplicável (inclusive o Holerite) concluído no mês.
  pontos: number;
  // Quantos clientes faltam em cada serviço, e quais (por empresa), na ordem das colunas (zero para quem fechou).
  faltam: { servicoId: string; nome: string; clientes: number; empresas: string[] }[];
};

export type PendenciaDoFuncionarioDto = {
  servicoId: string;
  nome: string;
  clientes: { clienteId: string; empresa: string; cnpj: string }[];
};

export type DetalheDoFuncionarioDto = {
  funcionario: FuncionarioAcompanhamentoDto;
  // Clientes pendentes agrupados pelo serviço que falta, na ordem das colunas; um cliente com
  // dois serviços faltando aparece nos dois.
  pendencias: PendenciaDoFuncionarioDto[];
  // Do mês mais antigo ao mais novo, com o mês consultado por último. Usa o Responsável de hoje em
  // todos os meses (não há histórico de atribuição).
  evolucao: { competencia: string; pontos: number; atribuidos: number }[];
  // Clientes incompletos há mais meses seguidos (até o mês consultado), do mais atrasado ao menos.
  maisAtrasados: { clienteId: string; empresa: string; cnpj: string; meses: number }[];
};

export type AcompanhamentoFuncionariosDto = {
  competencia: string;
  funcionarios: FuncionarioAcompanhamentoDto[];
  // Clientes sem Responsável: aparecem ao Líder e não contam para ninguém.
  semResponsavel: { clienteId: string; empresa: string; cnpj: string }[];
  // Só quando pedido um funcionário que tem clientes atribuídos no mês.
  detalhe?: DetalheDoFuncionarioDto;
};
