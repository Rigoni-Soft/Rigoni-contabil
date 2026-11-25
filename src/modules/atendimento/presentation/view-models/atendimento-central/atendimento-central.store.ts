import { create } from "zustand";

type AbaDoAtendimento = "espera" | "atendimento";

type AtendimentoCentralStore = {
  aba: AbaDoAtendimento;
  abertoId: string | null;
  escolherAba: (aba: AbaDoAtendimento) => void;
  abrir: (atendimentoId: string) => void;
  fecharConversa: () => void;
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
