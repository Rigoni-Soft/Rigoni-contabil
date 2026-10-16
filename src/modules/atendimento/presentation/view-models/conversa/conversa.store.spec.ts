import { ANEXO_PENDENTE_VAZIO, useConversaStore } from "./conversa.store";

const arquivo = (nome: string) => new File(["x"], nome);
const pendente = (nome: string, miniaturaUrl: string | null = null) => ({
  ...ANEXO_PENDENTE_VAZIO,
  arquivo: arquivo(nome),
  miniaturaUrl,
});

describe("useConversaStore", () => {
  // O jsdom não implementa revokeObjectURL.
  const revogar = jest.fn();
  URL.revokeObjectURL = revogar;

  beforeEach(() => {
    useConversaStore.setState({ anexosPendentes: {} });
    revogar.mockClear();
  });

  it("trocar o anexo libera a prévia do anterior", () => {
    const { trocarAnexoPendente } = useConversaStore.getState();
    trocarAnexoPendente("at-1", pendente("a.png", "blob:a"));
    trocarAnexoPendente("at-1", pendente("b.png", "blob:b"));

    expect(revogar).toHaveBeenCalledWith("blob:a");
    expect(useConversaStore.getState().anexosPendentes["at-1"].arquivo?.name).toBe("b.png");
  });

  it("a miniatura só entra se o arquivo ainda é o mesmo", () => {
    const { trocarAnexoPendente, completarMiniatura } = useConversaStore.getState();
    const atual = pendente("a.png");
    trocarAnexoPendente("at-1", atual);

    completarMiniatura("at-1", arquivo("outro.png"), arquivo("mini.png"));
    expect(useConversaStore.getState().anexosPendentes["at-1"].miniatura).toBeNull();

    completarMiniatura("at-1", atual.arquivo, arquivo("mini.png"));
    expect(useConversaStore.getState().anexosPendentes["at-1"].miniatura?.name).toBe("mini.png");
  });

  it("limpar remove o anexo do Atendimento e libera a prévia, sem tocar nos outros", () => {
    const { trocarAnexoPendente, limparAnexoPendente } = useConversaStore.getState();
    trocarAnexoPendente("at-1", pendente("a.png", "blob:a"));
    trocarAnexoPendente("at-2", pendente("b.png"));

    limparAnexoPendente("at-1");

    expect(revogar).toHaveBeenCalledWith("blob:a");
    expect(Object.keys(useConversaStore.getState().anexosPendentes)).toEqual(["at-2"]);
  });
});
