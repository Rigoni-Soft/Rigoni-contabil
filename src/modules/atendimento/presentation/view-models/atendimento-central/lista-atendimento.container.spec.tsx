import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ListaAtendimentoContainer } from "./lista-atendimento.container";
import { useAtendimentoCentral } from "./use-atendimento-central.hook";

jest.mock("./use-atendimento-central.hook", () => ({ useAtendimentoCentral: jest.fn() }));

type Entrada = React.ComponentProps<typeof ListaAtendimentoContainer>;
type Lista = ReturnType<typeof useAtendimentoCentral>;

const ENTRADA: Entrada = {
  usuarioId: "u-1",
  setorInicial: "contabil",
  filaInicial: [],
  meusInicial: [],
  podeEscolherSetor: false,
  supervisiona: false,
};
const ESPERA: Lista["itens"][number] = {
  id: "e-1",
  contato: "Maria",
  empresa: "Padaria Ltda",
  cnpj: null,
  telefone: "5561988887777",
  origem: null,
  dirigido: false,
  resumo: null,
  espera: "2 min",
  assumivel: true,
};
const CONVERSA: Lista["emAtendimento"][number] = {
  id: "c-1",
  href: "/atendimento/c-1",
  sinal: "s-1",
  titulo: "João",
  detalhe: "Mercado SA",
  aguardando: true,
  previa: "Bom dia",
};

const escolherAba = jest.fn();
const escolherSetor = jest.fn();
const assumir = jest.fn();
const abrir = jest.fn();
const lista = (parcial: Partial<Lista>): Lista => ({
  setor: "contabil",
  escolherSetor,
  itens: [ESPERA, { ...ESPERA, id: "e-2", contato: "Pedro" }],
  carregando: false,
  indisponivel: false,
  aba: "espera",
  escolherAba,
  anuncio: "",
  emAtendimento: [CONVERSA],
  daEquipe: undefined,
  aoLer: undefined,
  abertoId: null,
  abrir,
  assumir,
  assumindo: false,
  avisoDeAssuncao: undefined,
  ...parcial,
});
const monta = (parcial: Partial<Lista> = {}, entrada: Entrada = ENTRADA) => {
  jest.mocked(useAtendimentoCentral).mockReturnValue(lista(parcial));
  render(<ListaAtendimentoContainer {...entrada} />);
};

describe("ListaAtendimentoContainer", () => {
  it("mostra a espera do hook e as ações chamam as funções do hook", async () => {
    monta();

    expect(screen.getByRole("tab", { name: /Em espera/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("list", { name: "Clientes em espera" }).children).toHaveLength(2);

    await userEvent.click(screen.getByRole("tab", { name: /Em atendimento/ }));
    expect(escolherAba).toHaveBeenCalledWith("atendimento");
    await userEvent.click(screen.getByRole("button", { name: /Pedro/ }));
    expect(assumir).toHaveBeenCalledWith("e-2");
  });

  it("na aba de atendimento mostra as conversas e abrir chama o hook", async () => {
    monta({ aba: "atendimento" });

    await userEvent.click(screen.getByRole("button", { name: /João/ }));

    expect(abrir).toHaveBeenCalledWith("c-1");
    expect(screen.queryByRole("list", { name: "Clientes em espera" })).not.toBeInTheDocument();
  });

  it("só o Admin vê a escolha de Setor", async () => {
    monta({}, { ...ENTRADA, podeEscolherSetor: true });

    await userEvent.selectOptions(screen.getByLabelText("Setor"), "tributario");

    expect(escolherSetor).toHaveBeenCalledWith("tributario");
  });

  it("sem permissão de escolher Setor não mostra o seletor", () => {
    monta();

    expect(screen.queryByLabelText("Setor")).not.toBeInTheDocument();
  });
});
