import { create } from "zustand";

// `miniatura`: versão reduzida da imagem, gerada em segundo plano; vai junto no envio.
export type AnexoPendente = {
  arquivo: File | null;
  miniaturaUrl: string | null;
  miniatura: File | null;
  erro?: string;
};

export const ANEXO_PENDENTE_VAZIO: AnexoPendente = {
  arquivo: null,
  miniaturaUrl: null,
  miniatura: null,
};

function revogar(estado: AnexoPendente | undefined) {
  if (estado?.miniaturaUrl) URL.revokeObjectURL(estado.miniaturaUrl);
}

type ConversaStore = {
  // Arquivo escolhido e ainda não enviado, por Atendimento. É estado do cliente (um `File`, não vem
  // do servidor): o campo de resposta, que o envia, e a conversa, onde também se solta um arquivo,
  // são regiões diferentes da tela e o compartilham aqui (arquitetura.md, 4.7: Zustand).
  anexosPendentes: Record<string, AnexoPendente>;
  trocarAnexoPendente: (atendimentoId: string, novo: AnexoPendente) => void;
  // O arquivo pode ter sido trocado ou removido enquanto a miniatura saía.
  completarMiniatura: (atendimentoId: string, arquivo: File, miniatura: File) => void;
  limparAnexoPendente: (atendimentoId: string) => void;
};

export const useConversaStore = create<ConversaStore>((set) => ({
  anexosPendentes: {},
  trocarAnexoPendente: (atendimentoId, novo) =>
    set((estado) => {
      revogar(estado.anexosPendentes[atendimentoId]);
      return { anexosPendentes: { ...estado.anexosPendentes, [atendimentoId]: novo } };
    }),
  completarMiniatura: (atendimentoId, arquivo, miniatura) =>
    set((estado) => {
      const atual = estado.anexosPendentes[atendimentoId];
      if (atual?.arquivo !== arquivo) return estado;
      return {
        anexosPendentes: { ...estado.anexosPendentes, [atendimentoId]: { ...atual, miniatura } },
      };
    }),
  limparAnexoPendente: (atendimentoId) =>
    set((estado) => {
      revogar(estado.anexosPendentes[atendimentoId]);
      const { [atendimentoId]: _removido, ...resto } = estado.anexosPendentes;
      return { anexosPendentes: resto };
    }),
}));
