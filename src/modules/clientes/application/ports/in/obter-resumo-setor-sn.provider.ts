import type {
  CardResumoDto,
  FatiaComparativoDto,
  GrupoResumoDto,
} from "@/modules/clientes/application/ports/in/resumo-setor.provider";

export type ComparativosSnDto = {
  das: FatiaComparativoDto[];
  parcelamento: FatiaComparativoDto[];
  atividade: FatiaComparativoDto[];
  // Só o Líder vê: Funcionários comparados pela quantidade de Clientes com DAS "enviado".
  responsaveis?: FatiaComparativoDto[];
};

export type ResumoSetorSnDto = {
  totalClientes: number;
  cards: CardResumoDto[];
  grupos: GrupoResumoDto[];
  comparativos: ComparativosSnDto;
};
