import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AcoesCentralContainer } from "./acoes-central.container";
import { useAtendimentoCentralStore } from "./atendimento-central.store";
import { useConversaAberta } from "./use-conversa-aberta.hook";

jest.mock("./atendimento-central.store", () => ({ useAtendimentoCentralStore: jest.fn() }));
jest.mock("./use-conversa-aberta.hook", () => ({ useConversaAberta: jest.fn() }));
jest.mock(
  "@/modules/atendimento/presentation/view-models/conversa/acoes-conversa.container",
  () => ({
    AcoesConversaContainer: ({
      atendimentoId,
      aoSair,
    }: {
      atendimentoId: string;
      aoSair: () => void;
    }) => <button onClick={aoSair}>acoes {atendimentoId}</button>,
  }),
);

const fecharConversa = jest.fn();
type Store = ReturnType<typeof useAtendimentoCentralStore>;
type Aberta = ReturnType<typeof useConversaAberta>;
function monta(abertoId: string | null, data?: { encerrado: boolean }) {
  jest.mocked(useAtendimentoCentralStore).mockReturnValue({ abertoId, fecharConversa } as Store);
  jest.mocked(useConversaAberta).mockReturnValue({ data } as Aberta);
}

describe("AcoesCentralContainer", () => {
  it("entrega a conversa aberta às ações e sair chama o store", async () => {
    monta("at-1", { encerrado: false });
    render(<AcoesCentralContainer />);

    await userEvent.click(screen.getByRole("button", { name: "acoes at-1" }));

    expect(fecharConversa).toHaveBeenCalled();
  });

  it("não renderiza sem conversa aberta nem com a conversa encerrada", () => {
    monta(null);
    const { container, rerender } = render(<AcoesCentralContainer />);
    expect(container).toBeEmptyDOMElement();

    monta("at-1", { encerrado: true });
    rerender(<AcoesCentralContainer />);
    expect(container).toBeEmptyDOMElement();
  });
});
