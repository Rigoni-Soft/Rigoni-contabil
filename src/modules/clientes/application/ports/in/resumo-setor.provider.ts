export type CorStatusResumo = "em_dia" | "atencao" | "urgente" | "informativo" | "andamento";

export type ParcelamentoBucketDto = {
  codigo: string;
  interno: boolean;
  status: "pendente" | "enviado" | "quitado";
};

type ClienteBucketDto = {
  clienteId: string;
  empresa: string;
  cnpj: string;
  parcelamentos?: ParcelamentoBucketDto[];
};

export type CardResumoDto = {
  id: string;
  titulo: string;
  cor: CorStatusResumo;
  quantidade: number;
  descricao?: string;
  mensagemVazia?: string;
  clientes: ClienteBucketDto[];
};

export type FatiaComparativoDto = {
  id: string;
  rotulo: string;
  quantidade: number;
  cor: CorStatusResumo;
};

export type GrupoResumoDto = { titulo: string; cardIds: string[] };
