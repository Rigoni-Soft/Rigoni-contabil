import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QuadroDeFuncionarios } from "./quadro-de-funcionarios.component";

const PROPS = {
  empregados: [
    {
      id: "e1",
      nome: "Ana",
      href: "/ana",
      cartaoHref: "/cartao-ana",
      selecionado: true,
      selos: ["comissionado"],
    },
    {
      id: "e2",
      nome: "Bia",
      href: "/bia",
      cartaoHref: "/cartao-bia",
      selecionado: false,
      selos: ["desligado"],
    },
  ],
  emEdicao: {
    id: "e1",
    nome: "Ana",
    comissionado: true,
    ativo: true,
    semMovimento: false,
  },
  padraoComissionados: false,
  rotuloMes: "novembro de 2026",
  chaveDoNovo: 0,
  novoHref: "/novo",
  editavel: true,
  pendente: false,
  onCadastrar: jest.fn(),
  onCorrigir: jest.fn(),
  onAtivo: jest.fn(),
  onSemMovimento: jest.fn(),
  onPadrao: jest.fn(),
};

describe("QuadroDeFuncionarios", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lista os empregados com os selos", () => {
    render(<QuadroDeFuncionarios {...PROPS} />);

    expect(screen.getByRole("link", { name: "Editar Ana" })).toHaveAttribute("href", "/ana");
    expect(screen.getByRole("link", { name: "Cartão de ponto de Ana" })).toHaveAttribute(
      "href",
      "/cartao-ana",
    );
    expect(screen.getByText("comissionado")).toBeInTheDocument();
    expect(screen.getByText("desligado")).toBeInTheDocument();
  });

  it("quadro vazio avisa", () => {
    render(<QuadroDeFuncionarios {...PROPS} empregados={[]} emEdicao={undefined} />);

    expect(screen.getByText(/Nenhum empregado cadastrado neste cliente./)).toBeInTheDocument();
  });

  it("cadastra um empregado só com o nome e a marca", async () => {
    render(<QuadroDeFuncionarios {...PROPS} emEdicao={undefined} />);
    const novo = screen.getByRole("form", { name: "Novo empregado" });

    await userEvent.setup().type(novo.querySelector("input[name=nome]")!, "Caio");
    await userEvent.setup().click(screen.getByRole("button", { name: "Cadastrar empregado" }));

    const campos = PROPS.onCadastrar.mock.calls[0][0] as FormData;
    expect(campos.get("nome")).toBe("Caio");
    expect(campos.has("carga1")).toBe(false);
  });

  it("corrige, inativa, marca sem movimento e liga o padrão", async () => {
    render(<QuadroDeFuncionarios {...PROPS} />);
    const u = userEvent.setup();

    await u.click(screen.getByRole("button", { name: "Salvar empregado" }));
    await u.click(screen.getByRole("button", { name: "Desligar da empresa" }));
    await u.click(screen.getByRole("checkbox", { name: "Sem movimento em novembro de 2026" }));
    await u.click(screen.getByRole("checkbox", { name: /são comissionados/ }));

    expect(PROPS.onCorrigir).toHaveBeenCalledTimes(1);
    expect(PROPS.onAtivo).toHaveBeenCalledWith(false);
    expect(PROPS.onSemMovimento).toHaveBeenCalledWith(true);
    expect(PROPS.onPadrao).toHaveBeenCalledWith(true);
  });

  it("marca o empregado escolhido para o leitor de tela e avisa como começar", () => {
    const { rerender } = render(<QuadroDeFuncionarios {...PROPS} />);

    expect(screen.getByRole("link", { name: "Editar Ana" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: "Editar Bia" })).not.toHaveAttribute("aria-current");

    rerender(<QuadroDeFuncionarios {...PROPS} empregados={[]} emEdicao={undefined} />);
    expect(screen.getByText(/Cadastre o primeiro abaixo/)).toBeInTheDocument();
  });

  it("o erro do cadastro fica no formulário e ligado ao campo Nome", () => {
    render(<QuadroDeFuncionarios {...PROPS} emEdicao={undefined} erroDoNovo="Nome inválido." />);

    const novo = screen.getByRole("form", { name: "Novo empregado" });
    const nome = novo.querySelector("input[name=nome]")!;
    expect(nome).toHaveAttribute("aria-invalid", "true");
    expect(nome).toHaveAccessibleDescription("Nome inválido.");
  });

  it("com empregado em edição o Editar substitui o Novo e o link Novo empregado fica no título", () => {
    render(<QuadroDeFuncionarios {...PROPS} />);

    expect(screen.queryByRole("form", { name: "Novo empregado" })).not.toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Corrigir empregado" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Novo empregado" })).toHaveAttribute("href", "/novo");
    expect(screen.getByRole("link", { name: "Cancelar" })).toHaveAttribute("href", "/novo");
  });

  it("em leitura não oferece nenhuma escrita", () => {
    render(<QuadroDeFuncionarios {...PROPS} editavel={false} />);

    expect(screen.queryByRole("form", { name: "Novo empregado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar empregado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desligar da empresa" })).not.toBeInTheDocument();
  });
});
