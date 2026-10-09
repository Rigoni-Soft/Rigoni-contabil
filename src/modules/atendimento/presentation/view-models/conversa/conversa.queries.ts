import { useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  ConversaVista,
  DocumentoDisponivel,
} from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import {
  encerrarAtendimentoAction,
  enviarDocumentoAction,
  enviarMensagemAction,
  obterConversaAction,
  transferirAtendimentoAction,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.actions";
import { filaKeys } from "@/modules/atendimento/presentation/view-models/fila/fila.keys";
import { meusAtendimentosKeys } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.keys";

export const conversaKeys = {
  conversa: (atendimentoId: string) => ["atendimento", "conversa", atendimentoId] as const,
  transferencia: (atendimentoId: string) => ["atendimento", "transferir", atendimentoId] as const,
};

// ponytail: polling a cada 5 s para a Mensagem do cliente aparecer; Realtime (`*.realtime.ts`,
// arquitetura.md 4.2) quando o atraso incomodar.
const INTERVALO_MS = 5_000;

// `ativa` falso depois de transferida: a conversa deixa de ser do usuário, não há o que atualizar.
export function useConversaQuery(atendimentoId: string, initialData: ConversaVista, ativa = true) {
  return useQuery({
    queryKey: conversaKeys.conversa(atendimentoId),
    queryFn: async () => {
      const resultado = await obterConversaAction(atendimentoId);
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
    initialData,
    staleTime: INTERVALO_MS,
    refetchInterval: ativa ? INTERVALO_MS : false,
    retry: false,
  });
}

export function useEnviarDocumentoMutation(atendimentoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documento: DocumentoDisponivel) => {
      const resultado = await enviarDocumentoAction({ atendimentoId, documento });
      if (!resultado.ok) throw new Error(resultado.error.message);
    },
    // Também no erro: um envio entregue mas não registrado já deve aparecer (ou não) na conversa.
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: conversaKeys.conversa(atendimentoId) }),
  });
}

export function useTransferirAtendimentoMutation(atendimentoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: conversaKeys.transferencia(atendimentoId),
    // Devolve o Atendimento da Fila que o Funcionário liberado assumiu (null se não havia).
    mutationFn: async (dados: { setorDestino: string; resumo: string }) => {
      const resultado = await transferirAtendimentoAction({ atendimentoId, ...dados });
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data.proximoDaFila;
    },
    // O Atendimento mudou de mãos: a lista do dock precisa refletir.
    onSettled: () => queryClient.invalidateQueries({ queryKey: meusAtendimentosKeys.lista() }),
  });
}

export function useEncerrarAtendimentoMutation(atendimentoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    // Devolve o Atendimento da Fila que o Funcionário liberado assumiu (null se não havia).
    mutationFn: async () => {
      const resultado = await encerrarAtendimentoAction(atendimentoId);
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data.proximoDaFila;
    },
    // Também no erro: um encerramento feito mas com aviso falho já deve aparecer na conversa. O dock
    // e a Fila refletem o Funcionário livre e o Atendimento que ele assumiu.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: conversaKeys.conversa(atendimentoId) }),
        queryClient.invalidateQueries({ queryKey: meusAtendimentosKeys.lista() }),
        queryClient.invalidateQueries({ queryKey: filaKeys.todas() }),
      ]),
  });
}

export function useEnviarMensagemMutation(atendimentoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (texto: string) => {
      const resultado = await enviarMensagemAction({ atendimentoId, texto });
      if (!resultado.ok) throw new Error(resultado.error.message);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: conversaKeys.conversa(atendimentoId) }),
  });
}

// As regiões da tela (mensagens, compositor, ações) são Containers separados; quem transferiu o
// Atendimento avisa as outras pelo cache de mutações do React Query, sem estado paralelo.
export function useTransferenciaConcluida(
  atendimentoId: string,
): { setorDestino: string } | undefined {
  const concluidas = useMutationState({
    filters: { mutationKey: conversaKeys.transferencia(atendimentoId), status: "success" },
    select: (mutacao) => mutacao.state.variables as { setorDestino: string },
  });
  return concluidas.at(-1);
}
