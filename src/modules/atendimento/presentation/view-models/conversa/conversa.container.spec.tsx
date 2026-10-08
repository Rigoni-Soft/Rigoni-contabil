import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";

import { ConversaContainer } from "./conversa.container";

const aoEnviarServico = jest.fn();

jest.mock("@/modules/atendimento/presentation/view-models/conversa/use-conversa.hook", () => ({
  useConversa: () => ({
    titulo: "Maria",
    subtitulo: "Padaria Ltda",
    encerrado: false,
    semCliente: false,
    mensagens: [{ id: "1", lado: "contato", autor: "Maria", texto: "oi", hora: "08/10 12:30" }],
    servicos: [{ valor: "contrato", rotulo: "Contrato social" }],
    servicoEscolhido: "contrato",
    aoEscolherServico: jest.fn(),
    aoEnviarServico,
    enviando: false,
    aviso: undefined,
  }),
}));

describe("ConversaContainer", () => {
  it("passa a conversa do hook pra View", () => {
    render(<ConversaContainer atendimentoId="at-1" initialData={{} as ConversaVista} />);

    expect(screen.getByRole("heading", { name: "Maria" })).toBeInTheDocument();
    expect(screen.getByText("oi")).toBeInTheDocument();
  });

  it("clicar em Enviar chama a função do hook", async () => {
    const usuario = userEvent.setup();
    render(<ConversaContainer atendimentoId="at-1" initialData={{} as ConversaVista} />);

    await usuario.click(screen.getByRole("button", { name: "Enviar" }));

    expect(aoEnviarServico).toHaveBeenCalledTimes(1);
  });
});
