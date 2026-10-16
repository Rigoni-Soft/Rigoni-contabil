import { render, screen, within } from "@testing-library/react";
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
    aceitar: "image/png",
    anexo: undefined,
    aoAnexar: jest.fn(),
    aoRemoverAnexo: jest.fn(),
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
  localStorage.clear();
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

  it("insere o emoji na posição do cursor, fecha o seletor e devolve o foco ao campo", async () => {
    const usuario = userEvent.setup();
    render(<CompositorConversaContainer {...PROPS} />);
    const campo = screen.getByLabelText("Mensagem ao cliente") as HTMLTextAreaElement;
    await usuario.type(campo, "Olá Maria");
    campo.setSelectionRange(4, 4);

    await usuario.click(screen.getByRole("button", { name: "Inserir emoji" }));
    await usuario.click(screen.getByRole("button", { name: "Joinha" }));

    expect(campo).toHaveValue("Olá 👍Maria");
    expect(campo).toHaveFocus();
    expect(screen.queryByRole("group", { name: "Emojis" })).not.toBeInTheDocument();
    await usuario.keyboard("{Enter}");
    expect(aoEnviar).toHaveBeenCalledWith("Olá 👍Maria");
  });

  it("o seletor fecha com Esc (foco volta ao botão) e ao clicar fora", async () => {
    const usuario = userEvent.setup();
    render(<CompositorConversaContainer {...PROPS} />);
    const abrir = screen.getByRole("button", { name: "Inserir emoji" });

    await usuario.click(abrir);
    expect(screen.getByRole("group", { name: "Emojis" })).toBeInTheDocument();
    await usuario.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: "Emojis" })).not.toBeInTheDocument();
    expect(abrir).toHaveFocus();

    await usuario.click(abrir);
    await usuario.click(screen.getByLabelText("Mensagem ao cliente"));
    expect(screen.queryByRole("group", { name: "Emojis" })).not.toBeInTheDocument();
  });

  it("lembra os emojis escolhidos: com recentes, só a linha deles até ver todos", async () => {
    const usuario = userEvent.setup();
    render(<CompositorConversaContainer {...PROPS} />);
    const abrir = () => usuario.click(screen.getByRole("button", { name: "Inserir emoji" }));

    await abrir();
    await usuario.click(
      within(screen.getByRole("group", { name: "Gestos" })).getByRole("button", { name: "Joinha" }),
    );
    await abrir();
    expect(screen.getByRole("group", { name: "Recentes" })).toHaveTextContent("👍");
    expect(screen.queryByRole("group", { name: "Gestos" })).not.toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: "Ver todos os emojis" }));
    await usuario.click(
      within(screen.getByRole("group", { name: "Gestos" })).getByRole("button", { name: "Palmas" }),
    );
    await abrir();
    expect(screen.getByRole("group", { name: "Recentes" })).toHaveTextContent("👏👍");
  });

  it("ignora recentes inválidos ou repetidos vindos do storage", async () => {
    localStorage.setItem("emojis-recentes", JSON.stringify(["👍", 7, "👍", "👏"]));
    const usuario = userEvent.setup();
    render(<CompositorConversaContainer {...PROPS} />);

    await usuario.click(screen.getByRole("button", { name: "Inserir emoji" }));

    expect(screen.getByRole("group", { name: "Recentes" })).toHaveTextContent("👍👏");
  });

  it("Esc fecha o seletor mesmo com o foco no campo", async () => {
    const usuario = userEvent.setup();
    render(<CompositorConversaContainer {...PROPS} />);
    const abrir = screen.getByRole("button", { name: "Inserir emoji" });

    await usuario.click(abrir);
    expect(abrir).toHaveAttribute("aria-controls");
    screen.getByLabelText("Mensagem ao cliente").focus();
    await usuario.keyboard("{Escape}");

    expect(screen.queryByRole("group", { name: "Emojis" })).not.toBeInTheDocument();
    expect(abrir).not.toHaveAttribute("aria-controls");
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
