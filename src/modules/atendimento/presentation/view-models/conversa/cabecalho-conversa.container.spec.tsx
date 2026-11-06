import { render, screen } from "@testing-library/react";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";

import { CabecalhoConversaContainer } from "./cabecalho-conversa.container";

jest.mock("./use-cabecalho-conversa.hook", () => ({
  useCabecalhoConversa: () => ({ titulo: "Maria", subtitulo: "Padaria Ltda", encerrado: false }),
}));

describe("CabecalhoConversaContainer", () => {
  it("passa o cabeçalho do hook pra View", () => {
    render(<CabecalhoConversaContainer atendimentoId="at-1" initialData={{} as ConversaVista} />);

    expect(screen.getByRole("heading", { name: "Maria" })).toBeInTheDocument();
  });
});
