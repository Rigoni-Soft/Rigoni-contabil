import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";

import { ConversaContainer } from "./conversa.container";

const aoEnviarServico = jest.fn();
const aoTransferir = jest.fn();
const aoEnviarMensagem = jest.fn();

jest.mock("@/modules/atendimento/presentation/view-models/conversa/use-conversa.hook", () => ({
  useConversa: () => ({
    titulo: "Maria",
    subtitulo: "Padaria Ltda",
    encerrado: false,
    semCliente: false,
    mensagens: [{ id: "1", lado: "contato", autor: "Maria", texto: "oi", hora: "08/10 12:30" }],
    servicos: [{ valor: "contrato", rotulo: "Contrato social", grupo: "contrato" }],
    aoEnviarServico,
    enviando: false,
    aviso: undefined,
    setoresDestino: [{ valor: "tributario", rotulo: "Tributário" }],
    aoTransferir,
    transferindo: false,
    transferidoPara: undefined,
    avisoTransferencia: undefined,
    aoEnviarMensagem,
    enviandoMensagem: false,
    erroMensagem: undefined,
    mensagensEnviadas: 0,
  }),
}));

describe("ConversaContainer", () => {
  it("passa a conversa do hook pra View", () => {
    render(<ConversaContainer atendimentoId="at-1" initialData={{} as ConversaVista} />);

    expect(screen.getByRole("heading", { name: "Maria" })).toBeInTheDocument();
    expect(screen.getByText("oi")).toBeInTheDocument();
  });

  it("clicar no serviço chama a função do hook com ele", async () => {
    const usuario = userEvent.setup();
    render(<ConversaContainer atendimentoId="at-1" initialData={{} as ConversaVista} />);

    await usuario.click(screen.getByRole("button", { name: "Contrato social" }));

    expect(aoEnviarServico).toHaveBeenCalledWith("contrato");
  });

  it("enviar o formulário de transferência chama a função do hook com Setor e resumo", async () => {
    const usuario = userEvent.setup();
    render(<ConversaContainer atendimentoId="at-1" initialData={{} as ConversaVista} />);

    await usuario.selectOptions(screen.getByLabelText("Setor de destino"), "tributario");
    await usuario.type(screen.getByLabelText("Resumo do assunto"), "DAS em atraso");
    await usuario.click(screen.getByRole("button", { name: "Transferir" }));

    expect(aoTransferir).toHaveBeenCalledWith("tributario", "DAS em atraso");
  });

  it("enviar o campo de resposta chama a função do hook com o texto", async () => {
    const usuario = userEvent.setup();
    render(<ConversaContainer atendimentoId="at-1" initialData={{} as ConversaVista} />);

    await usuario.type(screen.getByLabelText("Mensagem ao cliente"), "Bom dia");
    await usuario.click(screen.getByRole("button", { name: "Enviar mensagem" }));

    expect(aoEnviarMensagem).toHaveBeenCalledWith("Bom dia");
  });
});
