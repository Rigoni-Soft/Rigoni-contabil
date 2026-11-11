import type { RegrasDaConvencao } from "@/modules/rh/domain/value-objects/regras-da-convencao.vo";

export type ConvencaoDto = {
  id: string;
  sindicato: string;
  // "AAAA-MM-DD".
  vigenciaInicio: string;
  vigenciaFim: string;
  arquivoNome: string;
  // "AAAA-MM-DD" do envio.
  enviadaEm: string;
  regras: RegrasDaConvencao;
};

export type InterruptoresDoClienteDto = { bancoDeHoras: boolean; trabalhoAosDomingos: boolean };

export type EmpregadoDaConvencaoDto = {
  id: string;
  nome: string;
  // Sindicato da convenção que o empregado segue; nulo = a única do Cliente.
  convencaoSindicato: string | null;
};

export type ConvencoesDoClienteDto = {
  clienteId: string;
  // Histórico: a de vigência mais recente primeiro; as anteriores seguem guardadas.
  convencoes: ConvencaoDto[];
  interruptores: InterruptoresDoClienteDto;
  empregados: EmpregadoDaConvencaoDto[];
  // Sobe e renova: Líder do RH e Admin.
  podeEnviar: boolean;
  // Interruptores e ponteiro do empregado: só o Responsável do RH do Cliente.
  podeEditar: boolean;
};
