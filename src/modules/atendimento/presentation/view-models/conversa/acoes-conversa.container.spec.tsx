import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";

import { AcoesConversaContainer } from "./acoes-conversa.container";
import { useAcoesConversa } from "./use-acoes-conversa.hook";

jest.mock("./use-acoes-conversa.hook", () => ({ useAcoesConversa: jest.fn() }));

const aoEnviarServico = jest.fn();
const acoes = (visivel: boolean) =>
  ({
    visivel,
    semCliente: false,
    servicos: [{ valor: "contrato", rotulo: "Contrato social", grupo: "contrato" }],
    aoEnviarServico,
    setoresDestino: [],
  }) as never;
const props = { atendimentoId: "at-1", initialData: {} as ConversaVista };

describe("AcoesConversaContainer", () => {
  it("clicar no serviço chama a função do hook com ele", async () => {
    jest.mocked(useAcoesConversa).mockReturnValue(acoes(true));
    render(<AcoesConversaContainer {...props} />);

    await userEvent.click(screen.getByRole("button", { name: "Contrato social" }));

    expect(aoEnviarServico).toHaveBeenCalledWith("contrato");
  });

  it("não aparece quando o hook diz que não está visível", () => {
    jest.mocked(useAcoesConversa).mockReturnValue(acoes(false));
    const { container } = render(<AcoesConversaContainer {...props} />);

    expect(container).toBeEmptyDOMElement();
  });
});
