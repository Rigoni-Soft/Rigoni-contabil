import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";

import { AcoesConversaContainer } from "./acoes-conversa.container";
import { CabecalhoConversaContainer } from "./cabecalho-conversa.container";
import { CompositorConversaContainer } from "./compositor-conversa.container";
import { MensagensConversaContainer } from "./mensagens-conversa.container";

const aoEnviarServico = jest.fn();
const aoTransferir = jest.fn();
const aoEnviar = jest.fn();
let acoesVisiveis = true;
let compositorVisivel = true;

jest.mock(
  "@/modules/atendimento/presentation/view-models/conversa/use-cabecalho-conversa.hook",
  () => ({
    useCabecalhoConversa: () => ({ titulo: "Maria", subtitulo: "Padaria Ltda", encerrado: false }),
  }),
);
jest.mock(
  "@/modules/atendimento/presentation/view-models/conversa/use-mensagens-conversa.hook",
  () => ({
    useMensagensConversa: () => ({
      mensagens: [
        { id: "1", lado: "contato", autor: "Maria", detalhe: null, texto: "oi", hora: "12:30" },
      ],
    }),
  }),
);
jest.mock("@/modules/atendimento/presentation/view-models/conversa/use-compositor.hook", () => ({
  useCompositor: () => ({
    visivel: compositorVisivel,
    aoEnviar,
    enviando: false,
    erro: undefined,
    enviadas: 0,
  }),
}));
jest.mock(
  "@/modules/atendimento/presentation/view-models/conversa/use-acoes-conversa.hook",
  () => ({
    useAcoesConversa: () => ({
      visivel: acoesVisiveis,
      transferidoPara: undefined,
      semCliente: false,
      servicos: [{ valor: "contrato", rotulo: "Contrato social", grupo: "contrato" }],
      aoEnviarServico,
      enviando: false,
      aviso: undefined,
      setoresDestino: [{ valor: "tributario", rotulo: "Tributário" }],
      aoTransferir,
      transferindo: false,
      avisoTransferencia: undefined,
    }),
  }),
);

const PROPS = { atendimentoId: "at-1", initialData: {} as ConversaVista };

beforeEach(() => {
  acoesVisiveis = true;
  compositorVisivel = true;
});

describe("CabecalhoConversaContainer", () => {
  it("passa o cabeçalho do hook pra View", () => {
    render(<CabecalhoConversaContainer {...PROPS} />);

    expect(screen.getByRole("heading", { name: "Maria" })).toBeInTheDocument();
  });
});

describe("MensagensConversaContainer", () => {
  it("passa as mensagens do hook pra View", () => {
    render(<MensagensConversaContainer {...PROPS} />);

    expect(screen.getByText("oi")).toBeInTheDocument();
  });
});

describe("CompositorConversaContainer", () => {
  it("enviar o campo chama a função do hook com o texto", async () => {
    const usuario = userEvent.setup();
    render(<CompositorConversaContainer {...PROPS} />);

    await usuario.type(screen.getByLabelText("Mensagem ao cliente"), "Bom dia");
    await usuario.click(screen.getByRole("button", { name: "Enviar mensagem" }));

    expect(aoEnviar).toHaveBeenCalledWith("Bom dia");
  });

  it("não aparece quando o hook diz que não está visível", () => {
    compositorVisivel = false;
    const { container } = render(<CompositorConversaContainer {...PROPS} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("AcoesConversaContainer", () => {
  it("clicar no serviço chama a função do hook com ele", async () => {
    const usuario = userEvent.setup();
    render(<AcoesConversaContainer {...PROPS} />);

    await usuario.click(screen.getByRole("button", { name: "Contrato social" }));

    expect(aoEnviarServico).toHaveBeenCalledWith("contrato");
  });

  it("enviar o formulário de transferência chama a função do hook com Setor e resumo", async () => {
    const usuario = userEvent.setup();
    render(<AcoesConversaContainer {...PROPS} />);

    await usuario.selectOptions(screen.getByLabelText("Setor de destino"), "tributario");
    await usuario.type(screen.getByLabelText("Resumo do assunto"), "DAS em atraso");
    await usuario.click(screen.getByRole("button", { name: "Transferir" }));

    expect(aoTransferir).toHaveBeenCalledWith("tributario", "DAS em atraso");
  });

  it("não aparece quando o hook diz que não está visível", () => {
    acoesVisiveis = false;
    const { container } = render(<AcoesConversaContainer {...PROPS} />);

    expect(container).toBeEmptyDOMElement();
  });
});
