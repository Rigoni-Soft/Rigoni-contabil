import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import type { DocumentoParaEnviar } from "@/modules/atendimento/application/ports/in/enviar-documento-ao-cliente.provider";
import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { subirAnexoEmPartes } from "@/modules/atendimento/presentation/view-models/conversa/anexo-em-partes.upload";
import {
  encerrarAtendimentoAction,
  enviarAnexoGuardadoAction,
  enviarDocumentoAction,
  enviarMensagemAction,
  obterConversaAction,
  obterMensagensAnterioresAction,
  reagirAMensagemAction,
  renovarLinksDeAnexosAction,
  transferirAtendimentoAction,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.actions";
import {
  acrescentarAnteriores,
  aplicarLinksRenovados,
  idsComLinkVencendo,
  manterHistorico,
  reaproveitarLinks,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.presenter";
import { filaKeys } from "@/modules/atendimento/presentation/view-models/fila/fila.queries";
import { meusAtendimentosKeys } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.queries";

export const conversaKeys = {
  conversa: (atendimentoId: string) => ["atendimento", "conversa", atendimentoId] as const,
  enviarAnexo: (atendimentoId: string) => ["atendimento", "enviar-anexo", atendimentoId] as const,
  transferencia: (atendimentoId: string) => ["atendimento", "transferir", atendimentoId] as const,
};

// ponytail: polling a cada 5 s para a Mensagem do cliente aparecer; Realtime (`*.realtime.ts`,
// arquitetura.md 4.2) quando o atraso incomodar.
const INTERVALO_MS = 5_000;

// Por rodada de polling: o lote de renovação e o tempo antes de pedir de novo o mesmo anexo (um
// objeto ausente não é pedido a cada 5 s).
const RENOVACAO_LOTE = 20;
const RENOVACAO_ESPERA_MS = 60_000;
const renovacaoPedidaEm = new Map<string, number>();

// O polling só reassina a janela recente; os anexos do histórico já aberto têm o link vencendo
// sozinhos. Renova, em lote e passando de novo pela autorização do servidor, só os que estão perto
// de vencer. Falhar não derruba a leitura: o link antigo fica e a próxima rodada tenta de novo.
async function renovarLinksVencendo(
  atendimentoId: string,
  conversa: ConversaVista,
  agora: number,
): Promise<ConversaVista> {
  const ids = idsComLinkVencendo(
    conversa,
    agora,
    RENOVACAO_LOTE,
    undefined,
    (id) => agora - (renovacaoPedidaEm.get(id) ?? 0) >= RENOVACAO_ESPERA_MS,
  );
  if (!ids.length) return conversa;
  for (const id of ids) renovacaoPedidaEm.set(id, agora);
  const renovadas = await renovarLinksDeAnexosAction({ atendimentoId, mensagemIds: ids }).catch(
    () => null,
  );
  return renovadas?.ok ? aplicarLinksRenovados(conversa, renovadas.data) : conversa;
}

// `ativa` falso depois de transferida: a conversa deixa de ser do usuário, não há o que atualizar.
export function useConversaQuery(atendimentoId: string, initialData: ConversaVista, ativa = true) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: conversaKeys.conversa(atendimentoId),
    queryFn: async () => {
      const resultado = await obterConversaAction(atendimentoId);
      if (!resultado.ok) throw new Error(resultado.error.message);
      // Links de anexo já obtidos continuam valendo: as imagens não recarregam a cada leitura.
      const anterior = queryClient.getQueryData<ConversaVista>(
        conversaKeys.conversa(atendimentoId),
      );
      const agora = Date.now();
      const conversa = reaproveitarLinks(
        manterHistorico(resultado.data, anterior),
        anterior,
        agora,
      );
      return renovarLinksVencendo(atendimentoId, conversa, agora);
    },
    initialData,
    staleTime: INTERVALO_MS,
    refetchInterval: ativa ? INTERVALO_MS : false,
    retry: false,
  });
}

// Histórico anterior ao que a tela já tem: entra no cache da conversa antes das Mensagens atuais.
export function useMensagensAnterioresMutation(atendimentoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const chave = conversaKeys.conversa(atendimentoId);
      const primeira = queryClient.getQueryData<ConversaVista>(chave)?.mensagens[0];
      if (!primeira) return;
      const resultado = await obterMensagensAnterioresAction({
        atendimentoId,
        antes: { criadoEm: primeira.criadoEm, id: primeira.id },
      });
      if (!resultado.ok) throw new Error(resultado.error.message);
      // Confere o cursor contra o cache de agora: o polling pode ter trocado a janela no caminho.
      queryClient.setQueryData<ConversaVista>(chave, (atual) =>
        atual ? acrescentarAnteriores(atual, primeira.id, resultado.data) : atual,
      );
    },
  });
}

export function useEnviarDocumentoMutation(atendimentoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documento: DocumentoParaEnviar) => {
      const resultado = await enviarDocumentoAction({ atendimentoId, documento });
      if (!resultado.ok) throw new Error(resultado.error.message);
    },
    // Também no erro: um envio entregue mas não registrado já deve aparecer (ou não) na conversa.
    onSettled: () => invalidarConversa(queryClient, atendimentoId),
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

function invalidarConversa(queryClient: QueryClient, atendimentoId: string) {
  return queryClient.invalidateQueries({ queryKey: conversaKeys.conversa(atendimentoId) });
}

export function useEnviarMensagemMutation(atendimentoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (texto: string) => {
      const resultado = await enviarMensagemAction({ atendimentoId, texto });
      if (!resultado.ok) throw new Error(resultado.error.message);
    },
    onSettled: () => invalidarConversa(queryClient, atendimentoId),
  });
}

// Imagem, documento ou áudio gravado: sobe em partes direto ao Storage (docs/adr/0007; o corpo de uma
// Server Action não passa de 4,5 MB na Vercel) e só então pede ao servidor que o confira e entregue,
// com a legenda e a miniatura. A mesma chave de mutação: a conversa trava igual enquanto envia.
function useEnviarGuardadoMutation(atendimentoId: string, falha: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: conversaKeys.enviarAnexo(atendimentoId),
    mutationFn: async ({
      arquivo,
      legenda,
      miniatura,
    }: {
      arquivo: File;
      legenda?: string;
      miniatura?: File | null;
    }) => {
      const caminho = await subirAnexoEmPartes(atendimentoId, arquivo);
      const dados = new FormData();
      dados.set("atendimentoId", atendimentoId);
      dados.set("caminho", caminho);
      dados.set("nome", arquivo.name);
      if (legenda) dados.set("legenda", legenda);
      if (miniatura) dados.set("miniatura", miniatura);
      // Sem rede: a action lança em vez de devolver o resultado, e a mensagem crua não diz o que fazer.
      const resultado = await enviarAnexoGuardadoAction(dados).catch(() => null);
      if (!resultado) throw new Error(falha);
      if (!resultado.ok) throw new Error(resultado.error.message);
    },
    onSettled: () => invalidarConversa(queryClient, atendimentoId),
  });
}

export function useEnviarAnexoMutation(atendimentoId: string) {
  return useEnviarGuardadoMutation(
    atendimentoId,
    "Não foi possível enviar o arquivo. Confira a conexão e tente de novo; o arquivo continua aqui.",
  );
}

export function useEnviarAudioMutation(atendimentoId: string) {
  return useEnviarGuardadoMutation(
    atendimentoId,
    "Não foi possível enviar o áudio. Confira a conexão e tente de novo; a gravação continua aqui.",
  );
}

export function useReagirAMensagemMutation(atendimentoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dados: { mensagemId: string; emoji: string }) => {
      const resultado = await reagirAMensagemAction({ atendimentoId, ...dados });
      if (!resultado.ok) throw new Error(resultado.error.message);
    },
    onSettled: () => invalidarConversa(queryClient, atendimentoId),
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
