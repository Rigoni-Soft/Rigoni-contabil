export type ServicoAcompanhamentoDto = {
  id: string;
  nome: string;
  // Serviço do sistema (Holerite): derivado, nunca marcado à mão.
  sistema: boolean;
};

export type CelulaAcompanhamentoDto = {
  servicoId: string;
  aplica: boolean;
  concluido: boolean;
};

export type ClienteAcompanhamentoDto = {
  clienteId: string;
  empresa: string;
  cnpj: string;
  // Serviços marcados "não se aplica" e concluídos no mês, por id.
  naoAplica: string[];
  concluidos: string[];
  // Responsável do RH; null = cliente sem Responsável.
  responsavel: { id: string; nome: string } | null;
};

export type LinhaAcompanhamentoDto = {
  clienteId: string;
  empresa: string;
  cnpj: string;
  // Uma célula por serviço, na ordem das colunas.
  celulas: CelulaAcompanhamentoDto[];
};

export type AcompanhamentoMensalDto = {
  competencia: string;
  servicos: ServicoAcompanhamentoDto[];
  linhas: LinhaAcompanhamentoDto[];
  // O Funcionário do RH marca os seus; o Líder e o Admin só leem.
  podeMarcar: boolean;
  podeGerirServicos: boolean;
};

export type FuncionarioAcompanhamentoDto = {
  id: string;
  nome: string;
  atribuidos: number;
  // Clientes com todo serviço aplicável (inclusive o Holerite) concluído no mês.
  pontos: number;
  // Quantos clientes faltam em cada serviço, na ordem das colunas (zero para quem fechou).
  faltam: { servicoId: string; nome: string; clientes: number }[];
};

export type PendenciaDoFuncionarioDto = {
  servicoId: string;
  nome: string;
  clientes: { clienteId: string; empresa: string }[];
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
  maisAtrasados: { clienteId: string; empresa: string; meses: number }[];
};

export type AcompanhamentoFuncionariosDto = {
  competencia: string;
  funcionarios: FuncionarioAcompanhamentoDto[];
  // Clientes sem Responsável: aparecem ao Líder e não contam para ninguém.
  semResponsavel: { clienteId: string; empresa: string }[];
  // Só quando pedido um funcionário que tem clientes atribuídos no mês.
  detalhe?: DetalheDoFuncionarioDto;
};
