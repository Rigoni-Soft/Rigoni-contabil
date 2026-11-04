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
