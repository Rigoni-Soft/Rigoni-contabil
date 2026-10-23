// Cores semânticas da tabela de status — mapeadas pra tokens do
// design system na presentation (nunca aqui, application não conhece Tailwind).
export type CorStatusResumo = "em_dia" | "atencao" | "urgente" | "informativo" | "andamento";

// Status do mês de um Parcelamento: quitado não gera mais guia; os demais dizem se a parcela do mês
// já tem envio registrado.
export type ParcelamentoBucketDto = {
  codigo: string;
  interno: boolean;
  status: "pendente" | "enviado" | "quitado";
};

// `parcelamentos` só vem nos cards do grupo Parcelamento.
export type ClienteBucketDto = {
  clienteId: string;
  empresa: string;
  cnpj: string;
  parcelamentos?: ParcelamentoBucketDto[];
};

export type CardResumoSnDto = {
  id: string;
  titulo: string;
  cor: CorStatusResumo;
  quantidade: number;
  // O que o card conta, para a lista dizer em uma linha o que ela filtra (cards de parcelamento).
  descricao?: string;
  // Por que a lista está vazia (cards de parcelamento); sem ela a lista usa a mensagem padrão.
  mensagemVazia?: string;
  clientes: ClienteBucketDto[];
};

// Fatia de um gráfico comparativo: id estável + rótulo pt-BR + contagem.
// `cor`: a mesma escala semântica dos cards; sem ela a fatia usa a cor do próprio id.
export type FatiaComparativoDto = {
  id: string;
  rotulo: string;
  quantidade: number;
  cor?: CorStatusResumo;
};

export type ComparativosSnDto = {
  das: FatiaComparativoDto[];
  parcelamento: FatiaComparativoDto[];
  atividade: FatiaComparativoDto[];
  // Só o Líder vê: Funcionários comparados pela quantidade de Clientes com DAS "enviado".
  responsaveis?: FatiaComparativoDto[];
};

export type ResumoSetorSnDto = {
  totalClientes: number;
  cards: CardResumoSnDto[];
  comparativos: ComparativosSnDto;
};
