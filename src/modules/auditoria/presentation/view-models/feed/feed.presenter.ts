import type { RegistroAcaoDto } from "@/modules/auditoria/application/dtos/registro-acao.dto";

export type RegistroAcaoView = {
  id: string;
  ator: string;
  setor: string;
  acao: string;
  alvo: string;
  resultado: string;
  dataHora: string;
};

// Devolutiva técnica PR #60, bloqueador 02: mesmo timezone de negócio usado
// pra calcular os limites do filtro em listar-registros.use-case.ts —
// `toLocaleString("pt-BR")` sem `timeZone` explícito usa o fuso do ambiente
// onde o código roda (navegador do usuário, servidor, CI), não determinístico
// e divergente do UTC usado no filtro.
export function registroAcaoParaView(registro: RegistroAcaoDto): RegistroAcaoView {
  return {
    ...registro,
    dataHora: new Date(registro.dataHora).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    }),
  };
}
