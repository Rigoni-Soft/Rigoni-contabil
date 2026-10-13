import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { FeriadosContainer } from "./feriados.container";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const cadastrarMock = jest.fn();
const removerMock = jest.fn();
jest.mock("@/main/atendimento.factory", () => ({
  makeCadastrarFeriado: async () => ({ execute: cadastrarMock }),
  makeRemoverFeriado: async () => ({ execute: removerMock }),
}));

const FERIADOS = [{ data: "2026-10-08", descricao: "Aniversário da cidade" }];

describe("FeriadosContainer", () => {
  beforeEach(() => {
    cadastrarMock.mockReset();
    removerMock.mockReset();
    refresh.mockReset();
  });

  it("lista os feriados cadastrados com a data em dd/mm/aaaa", () => {
    render(<FeriadosContainer feriados={FERIADOS} />);
    expect(screen.getByText("08/10/2026")).toBeInTheDocument();
    expect(screen.getByText(/Aniversário da cidade/)).toBeInTheDocument();
  });

  it("cadastra, limpa o formulário e recarrega a lista", async () => {
    cadastrarMock.mockResolvedValue(ok(undefined));
    const usuario = userEvent.setup();
    render(<FeriadosContainer feriados={[]} />);

    await usuario.type(screen.getByLabelText("Data"), "2026-10-08");
    await usuario.type(screen.getByLabelText("Descrição"), "Padroeira");
    await usuario.click(screen.getByRole("button", { name: "Cadastrar feriado" }));

    await screen.findByLabelText("Descrição");
    expect(cadastrarMock).toHaveBeenCalledWith({ data: "2026-10-08", descricao: "Padroeira" });
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByLabelText("Descrição")).toHaveValue("");
  });

  it("não envia com campos vazios", async () => {
    const usuario = userEvent.setup();
    render(<FeriadosContainer feriados={[]} />);
    await usuario.click(screen.getByRole("button", { name: "Cadastrar feriado" }));
    expect(await screen.findByText("Descrição obrigatória")).toBeInTheDocument();
    expect(cadastrarMock).not.toHaveBeenCalled();
  });

  it("remove o feriado escolhido", async () => {
    removerMock.mockResolvedValue(ok(undefined));
    const usuario = userEvent.setup();
    render(<FeriadosContainer feriados={FERIADOS} />);
    await usuario.click(screen.getByRole("button", { name: "Remover feriado de 08/10/2026" }));
    await screen.findByRole("button", { name: "Remover feriado de 08/10/2026" });
    expect(removerMock).toHaveBeenCalledWith({ data: "2026-10-08" });
    expect(refresh).toHaveBeenCalled();
  });

  it("mostra o erro do servidor e não recarrega", async () => {
    cadastrarMock.mockResolvedValue(err(new ForbiddenError("Só o Admin cadastra feriados.")));
    const usuario = userEvent.setup();
    render(<FeriadosContainer feriados={[]} />);
    await usuario.type(screen.getByLabelText("Data"), "2026-10-08");
    await usuario.type(screen.getByLabelText("Descrição"), "X");
    await usuario.click(screen.getByRole("button", { name: "Cadastrar feriado" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Só o Admin cadastra feriados.");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("Promise rejeitada vira erro genérico", async () => {
    cadastrarMock.mockRejectedValue(new Error("rede"));
    const usuario = userEvent.setup();
    render(<FeriadosContainer feriados={[]} />);
    await usuario.type(screen.getByLabelText("Data"), "2026-10-08");
    await usuario.type(screen.getByLabelText("Descrição"), "X");
    await usuario.click(screen.getByRole("button", { name: "Cadastrar feriado" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha inesperada");
  });
});
