import { create } from "zustand";

type AbaDoAtendimento = "espera" | "atendimento";

// Estado da tela Atendimento que as regiões dividem (lista, chat e ações): qual aba está aberta e
// qual conversa está no centro. É seleção do cliente, não dado do servidor (arquitetura.md, 4.7).
type AtendimentoCentralStore = {
  aba: AbaDoAtendimento;
  abertoId: string | null;
  escolherAba: (aba: AbaDoAtendimento) => void;
  abrir: (atendimentoId: string) => void;
  fecharConversa: () => void;
  // Assumiu: o Atendimento é do usuário, então a tela já o mostra aberto em "Em atendimento".
  aoAssumir: (atendimentoId: string) => void;
};

export const useAtendimentoCentralStore = create<AtendimentoCentralStore>((set) => ({
  aba: "espera",
  abertoId: null,
  escolherAba: (aba) => set({ aba }),
  abrir: (abertoId) => set({ abertoId }),
  fecharConversa: () => set({ abertoId: null }),
  aoAssumir: (abertoId) => set({ aba: "atendimento", abertoId }),
}));
