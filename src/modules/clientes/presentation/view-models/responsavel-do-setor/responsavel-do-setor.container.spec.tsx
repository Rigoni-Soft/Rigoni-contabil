import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as renderRtl, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { ResponsavelDoSetorContainer } from "./responsavel-do-setor.container";

const atribuirMock = jest.fn();
const listarMock = jest.fn();
jest.mock("@/main/clientes.factory", () => ({
  makeAtribuirResponsavelCliente: () => ({ execute: atribuirMock }),
  makeListarResponsaveisElegiveis: () => ({ execute: listarMock }),
}));

const CLIENTE = "9f1c9c6e-9d1a-4c9a-8b1e-2e2a4a5b6c7d";
const ATUAL = { id: "f1111111-1111-4111-8111-111111111111", nome: "Ana Contábil" };
const OUTRO = { id: "f2222222-2222-4222-8222-222222222222", nome: "Beto Contábil" };

function render(atual: typeof ATUAL | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderRtl(
    <QueryClientProvider client={client}>
      <ResponsavelDoSetorContainer clienteId={CLIENTE} setorRotulo="Contábil" atual={atual} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  atribuirMock.mockReset();
  listarMock.mockReset();
  listarMock.mockResolvedValue(ok([ATUAL, OUTRO]));
});

describe("ResponsavelDoSetorContainer", () => {
  it("mostra o Responsável atual, só habilita Salvar ao mudar e grava a troca", async () => {
    atribuirMock.mockResolvedValue(ok(undefined));
    render(ATUAL);

    expect(screen.getByLabelText("Responsável")).toHaveValue(ATUAL.id);
    expect(screen.getByRole("button", { name: "Salvar Responsável" })).toBeDisabled();
    await userEvent.click(screen.getByLabelText("Responsável"));
    await screen.findByRole("option", { name: OUTRO.nome });
    await userEvent.selectOptions(screen.getByLabelText("Responsável"), OUTRO.id);
    await userEvent.click(screen.getByRole("button", { name: "Salvar Responsável" }));

    await waitFor(() =>
      expect(atribuirMock).toHaveBeenCalledWith({ clienteId: CLIENTE, responsavelId: OUTRO.id }),
    );
    expect(await screen.findByText("Responsável atualizado.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar Responsável" })).toBeDisabled();
  });

  it("remove o Responsável escolhendo Sem responsável", async () => {
    atribuirMock.mockResolvedValue(ok(undefined));
    render(ATUAL);

    await userEvent.selectOptions(screen.getByLabelText("Responsável"), "");
    await userEvent.click(screen.getByRole("button", { name: "Salvar Responsável" }));

    await waitFor(() =>
      expect(atribuirMock).toHaveBeenCalledWith({ clienteId: CLIENTE, responsavelId: null }),
    );
  });

  it("mostra o motivo da recusa e mantém a escolha para tentar de novo", async () => {
    atribuirMock.mockResolvedValue(
      err(new ForbiddenError("Só o Líder do Setor atribui o Responsável.")),
    );
    render(null);

    await userEvent.click(screen.getByLabelText("Responsável"));
    await screen.findByRole("option", { name: ATUAL.nome });
    await userEvent.selectOptions(screen.getByLabelText("Responsável"), ATUAL.id);
    await userEvent.click(screen.getByRole("button", { name: "Salvar Responsável" }));

    expect(
      await screen.findByText("Só o Líder do Setor atribui o Responsável."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar Responsável" })).toBeEnabled();
  });
});
