import { create } from "zustand";

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
  anexosPendentes: Record<string, AnexoPendente>;
  trocarAnexoPendente: (atendimentoId: string, novo: AnexoPendente) => void;
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
      const resto = { ...estado.anexosPendentes };
      delete resto[atendimentoId];
      return { anexosPendentes: resto };
    }),
}));
