import type { RegistroAcaoDto } from "@/modules/auditoria/application/dtos/registro-acao.dto";
import { FUSO_DE_NEGOCIO } from "@/shared/kernel/mes-atual";

export type RegistroAcaoView = {
  id: string;
  ator: string;
  setor: string;
  acao: string;
  alvo: string;
  resultado: string;
  dataHora: string;
};

export function registroAcaoParaView(registro: RegistroAcaoDto): RegistroAcaoView {
  return {
    ...registro,
    dataHora: new Date(registro.dataHora).toLocaleString("pt-BR", {
      timeZone: FUSO_DE_NEGOCIO,
    }),
  };
}
