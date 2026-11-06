import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";

import { CompositorConversaContainer } from "./compositor-conversa.container";

const aoEnviar = jest.fn();
jest.mock("./use-compositor.hook", () => ({
  useCompositor: () => ({
    visivel: true,
    aoEnviar,
    enviando: false,
    enviadas: 0,
    aceitar: "image/png",
    aoAnexar: jest.fn(),
    aoRemoverAnexo: jest.fn(),
  }),
}));

describe("CompositorConversaContainer", () => {
  it("enviar o campo chama a função do hook com o texto", async () => {
    render(<CompositorConversaContainer atendimentoId="at-1" initialData={{} as ConversaVista} />);

    await userEvent.type(screen.getByLabelText("Mensagem ao cliente"), "Bom dia");
    await userEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));

    expect(aoEnviar).toHaveBeenCalledWith("Bom dia");
  });
});
