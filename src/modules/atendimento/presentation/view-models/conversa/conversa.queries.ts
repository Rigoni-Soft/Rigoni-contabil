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
  buscarClienteParaContatoUraAction,
  cadastrarContatoUraAction,
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
  intervaloDaConversa,
  manterHistorico,
  POLLING_RAPIDO_MS,
  reaproveitarLinks,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.presenter";
import { filaKeys } from "@/modules/atendimento/presentation/view-models/fila/fila.queries";
import { meusAtendimentosKeys } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.queries";
import { ANEXO_LINK_MARGEM_MS } from "@/shared/kernel/anexo";

export const conversaKeys = {
  conversa: (atendimentoId: string) => ["atendimento", "conversa", atendimentoId] as const,
  enviarAnexo: (atendimentoId: string) => ["atendimento", "enviar-anexo", atendimentoId] as const,
  transferencia: (atendimentoId: string) => ["atendimento", "transferir", atendimentoId] as const,
};

const INTERVALO_MS = POLLING_RAPIDO_MS;

const RENOVACAO_LOTE = 20;
const RENOVACAO_ESPERA_MS = 60_000;
const renovacaoPedidaEm = new Map<string, number>();

const ignorarFalhaDaRenovacao = () => null;
const semRespostaDoServidor = () => null;

async function renovarLinksVencendo(
  atendimentoId: string,
  conversa: ConversaVista,
  agora: number,
): Promise<ConversaVista> {
  const ids = idsComLinkVencendo(
    conversa,
    agora,
    RENOVACAO_LOTE,
    ANEXO_LINK_MARGEM_MS,
    (id) => agora - (renovacaoPedidaEm.get(id) ?? 0) >= RENOVACAO_ESPERA_MS,
  );
  if (!ids.length) return conversa;
  for (const id of ids) renovacaoPedidaEm.set(id, agora);
  const renovadas = await renovarLinksDeAnexosAction({ atendimentoId, mensagemIds: ids }).catch(
    ignorarFalhaDaRenovacao,
  );
  return renovadas?.ok ? aplicarLinksRenovados(conversa, renovadas.data) : conversa;
}

export function useConversaQuery(atendimentoId: string, initialData: ConversaVista, ativa = true) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: conversaKeys.conversa(atendimentoId),
    queryFn: async () => {
      const resultado = await obterConversaAction(atendimentoId);
      if (!resultado.ok) throw new Error(resultado.error.message);
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
    refetchInterval: ativa ? (query) => intervaloDaConversa(query.state.data, Date.now()) : false,
    retry: false,
  });
}

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
    onSettled: () => invalidarConversa(queryClient, atendimentoId),
  });
}

export function useTransferirAtendimentoMutation(atendimentoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: conversaKeys.transferencia(atendimentoId),
    mutationFn: async (dados: { setorDestino: string; resumo: string }) => {
      const resultado = await transferirAtendimentoAction({ atendimentoId, ...dados });
      if (!resultado.ok) throw new Error(resultado.error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: meusAtendimentosKeys.lista() }),
  });
}

export function useBuscarClienteParaContatoMutation(atendimentoId: string) {
  return useMutation({
    mutationFn: async (cnpj: string) => {
      const resultado = await buscarClienteParaContatoUraAction({ atendimentoId, cnpj });
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
  });
}

export function useCadastrarContatoUraMutation(atendimentoId: string) {
  return useMutation({
    mutationFn: async (dados: { clienteId: string; nome: string; email: string }) => {
      const resultado = await cadastrarContatoUraAction({ atendimentoId, ...dados });
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
  });
}

export function useEncerrarAtendimentoMutation(atendimentoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const resultado = await encerrarAtendimentoAction(atendimentoId);
      if (!resultado.ok) throw new Error(resultado.error.message);
    },
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
      const resultado = await enviarAnexoGuardadoAction(dados).catch(semRespostaDoServidor);
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

export function useTransferenciaConcluida(
  atendimentoId: string,
): { setorDestino: string } | undefined {
  const concluidas = useMutationState({
    filters: { mutationKey: conversaKeys.transferencia(atendimentoId), status: "success" },
    select: (mutacao) => mutacao.state.variables as { setorDestino: string },
  });
  return concluidas.at(-1);
}
