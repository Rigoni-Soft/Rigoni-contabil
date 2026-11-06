import { render, screen } from "@testing-library/react";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";

import { MensagensConversaContainer } from "./mensagens-conversa.container";

jest.mock("./use-mensagens-conversa.hook", () => ({
  useMensagensConversa: () => ({
    mensagens: [
      { id: "1", lado: "contato", autor: "Maria", detalhe: null, texto: "oi", hora: "12:30" },
    ],
  }),
}));

describe("MensagensConversaContainer", () => {
  it("passa as mensagens do hook pra View", () => {
    render(<MensagensConversaContainer atendimentoId="at-1" initialData={{} as ConversaVista} />);

    expect(screen.getByText("oi")).toBeInTheDocument();
  });
});
