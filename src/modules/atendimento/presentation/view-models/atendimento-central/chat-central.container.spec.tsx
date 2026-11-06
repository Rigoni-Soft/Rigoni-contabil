import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useAtendimentoCentralStore } from "./atendimento-central.store";
import { ChatCentralContainer } from "./chat-central.container";
import { useConversaAberta } from "./use-conversa-aberta.hook";

jest.mock("./atendimento-central.store", () => ({ useAtendimentoCentralStore: jest.fn() }));
jest.mock("./use-conversa-aberta.hook", () => ({ useConversaAberta: jest.fn() }));
jest.mock(
  "@/modules/atendimento/presentation/view-models/conversa/cabecalho-conversa.container",
  () => ({
    CabecalhoConversaContainer: ({ atendimentoId }: { atendimentoId: string }) => (
      <p>cabecalho {atendimentoId}</p>
    ),
  }),
);
jest.mock(
  "@/modules/atendimento/presentation/view-models/conversa/mensagens-conversa.container",
  () => ({ MensagensConversaContainer: () => <p>mensagens</p> }),
);
jest.mock(
  "@/modules/atendimento/presentation/view-models/conversa/compositor-conversa.container",
  () => ({ CompositorConversaContainer: () => <p>compositor</p> }),
);

const fecharConversa = jest.fn();
type Store = ReturnType<typeof useAtendimentoCentralStore>;
type Aberta = ReturnType<typeof useConversaAberta>;
function monta(abertoId: string | null, aberta: Partial<Aberta>) {
  jest.mocked(useAtendimentoCentralStore).mockReturnValue({ abertoId, fecharConversa } as Store);
  jest.mocked(useConversaAberta).mockReturnValue(aberta as Aberta);
}

describe("ChatCentralContainer", () => {
  it("monta as regiões da conversa aberta e Voltar chama o store", async () => {
    monta("at-1", { data: { encerrado: false } as Aberta["data"] });
    render(<ChatCentralContainer />);

    expect(screen.getByText("cabecalho at-1")).toBeInTheDocument();
    expect(screen.getByText("mensagens")).toBeInTheDocument();
    expect(screen.getByText("compositor")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Voltar à lista/ }));
    expect(fecharConversa).toHaveBeenCalled();
  });

  it("sem conversa aberta não monta as regiões", () => {
    monta(null, {});
    render(<ChatCentralContainer />);

    expect(screen.queryByText("mensagens")).not.toBeInTheDocument();
  });

  it("mostra o convite sem conversa, o carregando e o erro da primeira leitura", () => {
    monta(null, {});
    const { rerender } = render(<ChatCentralContainer />);
    expect(screen.getByText("Escolha um atendimento para conversar.")).toBeInTheDocument();

    monta("at-1", {});
    rerender(<ChatCentralContainer />);
    expect(screen.getByRole("status")).toHaveTextContent("Abrindo a conversa…");

    monta("at-1", { isError: true });
    rerender(<ChatCentralContainer />);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível abrir a conversa.");
  });
});
