import type { RegrasDaConvencao } from "@/shared/kernel/regras-da-convencao";

export type ConvencaoDto = {
  id: string;
  sindicato: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  arquivoNome: string;
  enviadaEm: string;
  regras: RegrasDaConvencao;
};

export type InterruptoresDoClienteDto = { bancoDeHoras: boolean; trabalhoAosDomingos: boolean };

type EmpregadoDaConvencaoDto = {
  id: string;
  nome: string;
  convencaoSindicato: string | null;
};

export type ConvencoesDoClienteDto = {
  clienteId: string;
  convencoes: ConvencaoDto[];
  interruptores: InterruptoresDoClienteDto;
  empregados: EmpregadoDaConvencaoDto[];
  podeEnviar: boolean;
  podeEditar: boolean;
};
