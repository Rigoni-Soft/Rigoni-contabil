import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { anexarAlteracaoContratualAction } from "./anexar-alteracao-contratual.actions";
import { AnexarAlteracaoContratualContainer } from "./anexar-alteracao-contratual.container";

jest.mock("./anexar-alteracao-contratual.actions", () => ({
  anexarAlteracaoContratualAction: jest.fn(),
}));
jest.mock("../visualizar-documento-contratual/documentos-contratuais.queries", () => ({
  chaveDocumentosContratuais: (id: string) => ["docs", id],
  useDocumentosContratuais: () => ({
    data: [{ tipo: "alteracao", numero: 2, data: "2025-03-10", arquivo: "2-ata.pdf" }],
  }),
}));

const acao = anexarAlteracaoContratualAction as jest.MockedFunction<
  typeof anexarAlteracaoContratualAction
>;
const CLIENTE = "11111111-1111-1111-1111-111111111111";
const hidePopover = jest.fn();

function pdf(nome: string, tamanho = 8) {
  return new File([new Uint8Array(tamanho)], nome, { type: "application/pdf" });
}

function montar() {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <AnexarAlteracaoContratualContainer clienteId={CLIENTE} />
    </QueryClientProvider>,
  );
  const dialogo = screen.getByRole("dialog", { hidden: true });
  return {
    dialogo,
    arquivo: () => within(dialogo).getByLabelText(/^Arquivo/, { selector: "input" }),
    numero: () => within(dialogo).getByLabelText("Nº da alteração", { selector: "input" }),
    data: () => within(dialogo).getByLabelText("Data da alteração", { selector: "input" }),
    enviar: () => within(dialogo).getByRole("button", { name: "Anexar", hidden: true }),
  };
}

describe("fluxo de anexar alteração (hook + container, #141)", () => {
  beforeEach(() => {
    acao.mockReset();
    hidePopover.mockReset();
    Object.defineProperty(HTMLElement.prototype, "hidePopover", {
      configurable: true,
      value: hidePopover,
    });
  });

  it("sugere o nº pelo arquivo, envia, confirma na seção e fecha o diálogo", async () => {
    acao.mockResolvedValue({ ok: true, data: undefined });
    const usuario = userEvent.setup();
    const tela = montar();

    await usuario.upload(tela.arquivo(), pdf("3-ata.pdf"));
    expect(tela.numero()).toHaveValue(3);
    fireEvent.change(tela.data(), { target: { value: "2025-04-01" } });
    await usuario.click(tela.enviar());

    await waitFor(() =>
      expect(acao).toHaveBeenCalledWith(
        expect.objectContaining({ clienteId: CLIENTE, numero: 3, data: "2025-04-01" }),
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Alteração nº 3 anexada.");
    expect(hidePopover).toHaveBeenCalled();
  });

  it("nº repetido é barrado pela lista carregada, sem chamar a Server Action", async () => {
    const usuario = userEvent.setup();
    const tela = montar();

    await usuario.upload(tela.arquivo(), pdf("2-outra.pdf"));
    fireEvent.change(tela.data(), { target: { value: "2025-04-01" } });
    await usuario.click(tela.enviar());

    expect(
      await within(tela.dialogo).findByText("Já existe a alteração nº 2 deste Cliente."),
    ).toBeInTheDocument();
    expect(acao).not.toHaveBeenCalled();
  });

  it("arquivo acima de 4 MB é recusado já ao escolher", async () => {
    const usuario = userEvent.setup();
    const tela = montar();

    await usuario.upload(tela.arquivo(), pdf("5-grande.pdf", 4 * 1024 * 1024 + 1));

    expect(
      await within(tela.dialogo).findByText("O arquivo passa de 4 MB. Envie um arquivo menor."),
    ).toBeInTheDocument();
  });

  it("falha do servidor mostra o erro, e fechar o diálogo descarta rascunho e erro", async () => {
    acao.mockResolvedValue({
      ok: false,
      error: { code: "PERSISTENCIA_ERROR", message: "Não foi possível anexar a alteração." },
    });
    const usuario = userEvent.setup();
    const tela = montar();

    await usuario.upload(tela.arquivo(), pdf("4-ata.pdf"));
    fireEvent.change(tela.data(), { target: { value: "2025-04-01" } });
    await usuario.click(tela.enviar());
    expect(
      await within(tela.dialogo).findByText("Não foi possível anexar a alteração."),
    ).toBeInTheDocument();
    // Preserva o que foi digitado enquanto o diálogo segue aberto.
    expect(tela.numero()).toHaveValue(4);

    act(() => {
      fireEvent(tela.dialogo, Object.assign(new Event("toggle"), { newState: "closed" }));
    });

    await waitFor(() => expect(tela.numero()).toHaveValue(null));
    expect(
      within(tela.dialogo).queryByText("Não foi possível anexar a alteração."),
    ).not.toBeInTheDocument();
  });
});
