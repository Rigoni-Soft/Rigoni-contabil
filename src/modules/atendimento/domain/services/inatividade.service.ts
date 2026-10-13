import {
  estaAbertoEm,
  expedienteDecorrido,
} from "@/modules/atendimento/domain/services/expediente.service";

// Ator de sistema da URA na auditoria (a tabela não exige um perfil para o ator).
export const URA_ATOR_ID = "00000000-0000-0000-0000-000000000000";

const MINUTO = 60_000;
export const INATIVIDADE_MS = 120 * MINUTO;
export const PRAZO_APOS_AVISO_MS = 10 * MINUTO;

// Quem está inativo: o outro lado do último que escreveu.
export type Inativo = "contato" | "funcionario";

export type EstadoInatividade = {
  ultimaDoContato: Date | null;
  ultimaDoFuncionario: Date | null;
  aviso: { em: Date; de: Inativo } | null;
};

export type DecisaoInatividade =
  { acao: "nada" } | { acao: "avisar"; de: Inativo } | { acao: "cancelar" } | { acao: "encerrar" };

// As duas esperas (2 horas e 10 minutos) correm só dentro do expediente, e a URA só age com o
// escritório aberto: o aviso e o encerramento nunca saem à noite.
export function decidirInatividade(
  estado: EstadoInatividade,
  agora: Date,
  extras: ReadonlySet<string>,
): DecisaoInatividade {
  const { ultimaDoContato, ultimaDoFuncionario, aviso } = estado;
  if (aviso) {
    const ultima = aviso.de === "contato" ? ultimaDoContato : ultimaDoFuncionario;
    // Quem estava inativo agiu depois do aviso.
    if (ultima && ultima > aviso.em) return { acao: "cancelar" };
  }
  if (!estaAbertoEm(agora, extras)) return { acao: "nada" };
  if (aviso) {
    return expedienteDecorrido(aviso.em, agora, extras) >= PRAZO_APOS_AVISO_MS
      ? { acao: "encerrar" }
      : { acao: "nada" };
  }
  if (!ultimaDoContato && !ultimaDoFuncionario) return { acao: "nada" };
  const contatoPorUltimo =
    !!ultimaDoContato && (!ultimaDoFuncionario || ultimaDoContato > ultimaDoFuncionario);
  const ultima = (contatoPorUltimo ? ultimaDoContato : ultimaDoFuncionario) as Date;
  if (expedienteDecorrido(ultima, agora, extras) < INATIVIDADE_MS) return { acao: "nada" };
  return { acao: "avisar", de: contatoPorUltimo ? "funcionario" : "contato" };
}

// Aviso de inatividade ainda pendente para o Funcionário: a URA avisou que ele era o inativo e ele
// não escreveu depois (a Mensagem dele já cancela, mesmo antes de o job limpar a marca).
export function avisoPendenteAoFuncionario(
  aviso: { de: Inativo; em: string } | null,
  mensagens: { autor: string; criadoEm: string }[],
): boolean {
  if (aviso?.de !== "funcionario") return false;
  const avisoEm = new Date(aviso.em).getTime();
  return !mensagens.some(
    (m) => m.autor === "funcionario" && new Date(m.criadoEm).getTime() > avisoEm,
  );
}

export const AVISO_INATIVIDADE_AO_CLIENTE =
  "Olá! Não recebemos resposta há um tempo. Se não houver nenhuma ação em 10 minutos, o atendimento será encerrado.";
export const AVISO_ENCERRAMENTO_AO_CLIENTE =
  "Seu atendimento foi encerrado por inatividade. Se precisar, é só nos chamar de novo.";
