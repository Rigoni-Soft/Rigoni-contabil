import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QuadroDeFuncionarios } from "./quadro-de-funcionarios.component";

const CARGAS = ["00:00", "08:45", "08:45", "08:45", "08:45", "08:45", "04:00"];
const PROPS = {
  empregados: [
    { id: "e1", nome: "Ana", href: "/ana", selecionado: true, selos: ["comissionado"] },
    { id: "e2", nome: "Bia", href: "/bia", selecionado: false, selos: ["inativo"] },
  ],
  emEdicao: {
    id: "e1",
    nome: "Ana",
    comissionado: true,
    ativo: true,
    semMovimento: false,
    cargas: CARGAS,
  },
  cargasPadrao: CARGAS,
  padraoComissionados: false,
  rotuloMes: "novembro de 2026",
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

    expect(screen.getByRole("link", { name: "Ana" })).toHaveAttribute("href", "/ana");
    expect(screen.getByText("comissionado")).toBeInTheDocument();
    expect(screen.getByText("inativo")).toBeInTheDocument();
  });

  it("quadro vazio avisa", () => {
    render(<QuadroDeFuncionarios {...PROPS} empregados={[]} emEdicao={undefined} />);

    expect(screen.getByText("Nenhum empregado cadastrado neste cliente.")).toBeInTheDocument();
  });

  it("cadastra um empregado com nome e Jornada de partida", async () => {
    render(<QuadroDeFuncionarios {...PROPS} />);
    const novo = screen.getByRole("form", { name: "Novo empregado" });

    await userEvent.setup().type(novo.querySelector("input[name=nome]")!, "Caio");
    await userEvent.setup().click(screen.getByRole("button", { name: "Cadastrar empregado" }));

    const campos = PROPS.onCadastrar.mock.calls[0][0] as FormData;
    expect(campos.get("nome")).toBe("Caio");
    expect(campos.get("carga1")).toBe("08:45");
  });

  it("corrige, inativa, marca sem movimento e liga o padrão", async () => {
    render(<QuadroDeFuncionarios {...PROPS} />);
    const u = userEvent.setup();

    await u.click(screen.getByRole("button", { name: "Salvar empregado" }));
    await u.click(screen.getByRole("button", { name: "Inativar empregado" }));
    await u.click(screen.getByRole("checkbox", { name: "Sem movimento em novembro de 2026" }));
    await u.click(screen.getByRole("checkbox", { name: /são comissionados/ }));

    expect(PROPS.onCorrigir).toHaveBeenCalledTimes(1);
    expect(PROPS.onAtivo).toHaveBeenCalledWith(false);
    expect(PROPS.onSemMovimento).toHaveBeenCalledWith(true);
    expect(PROPS.onPadrao).toHaveBeenCalledWith(true);
  });

  it("em leitura não oferece nenhuma escrita", () => {
    render(<QuadroDeFuncionarios {...PROPS} editavel={false} />);

    expect(screen.queryByRole("form", { name: "Novo empregado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar empregado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inativar empregado" })).not.toBeInTheDocument();
  });
});
