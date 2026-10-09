import type { SetorSlug } from "@/shared/kernel/setores";

export const filaKeys = {
  // Prefixo de toda leitura da Fila: invalida todas de uma vez.
  todas: () => ["atendimento", "fila"] as const,
  // `null` = a Fila do Setor do próprio usuário: a tela, a barra lateral da conversa e o aviso
  // global leem a mesma chave, então viram uma leitura só.
  setor: (setor: SetorSlug | null) => [...filaKeys.todas(), setor ?? "minha"] as const,
};
