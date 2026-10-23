import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as renderRtl, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CadastroOperacionalClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { ok } from "@/shared/kernel/result";

import { EditarCadastroOperacionalContainer } from "./editar-cadastro-operacional.container";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

// A action tem teste próprio; aqui a tela é testada contra o contrato dela (jsdom não tem File#arrayBuffer).
const lerMock = jest.fn();
jest.mock("./ler-pdf-de-parcelamento.actions", () => ({
  lerPdfDeParcelamentoAction: (...args: unknown[]) => lerMock(...args),
}));
const salvarParcelamentosMock = jest.fn();
const editarMock = jest.fn();
jest.mock("@/main/clientes.factory", () => ({
  makeEditarCadastroOperacionalCliente: () => ({ execute: editarMock }),
  makeSalvarParcelamentosCliente: () => ({ execute: salvarParcelamentosMock }),
  makeListarDocumentosContratuaisCliente: () => ({ execute: async () => ok([]) }),
  makeObterLinkDocumentoContratual: () => ({ execute: jest.fn() }),
}));

const dados: CadastroOperacionalClienteDto = {
  id: "9f1c9c6e-9d1a-4c9a-8b1e-2e2a4a5b6c7d",
  empresa: "Padaria Pão Quente Ltda",
  cnpj: "11444777000161",
  regime: "simples_nacional",
  formaEnvio: "whatsapp",
  contatos: [{ id: "c1", nome: "Maria", telefone: "11999990000", padrao: true }],
  documentoObrigatorio: "positivo",
  dasStatus: "pronto",
  dataEnvioDas: null,
  parcelamentos: [],
  observacoesGerais: "",
  atividadeMes: { industria: false, comercio: true, servico: false },
  responsavelId: null,
  responsavelNome: null,
};

const okAction = <T,>(data: T) => ({ ok: true as const, data });

const pdf = new File([new Uint8Array([1, 2, 3])], "acordo.pdf", { type: "application/pdf" });

function render() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderRtl(
    <QueryClientProvider client={client}>
      <EditarCadastroOperacionalContainer dados={dados} readOnly={false} />
    </QueryClientProvider>,
  );
}

async function anexarPdfNoParcelamentoNovo(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(screen.getByRole("button", { name: /adicionar parcelamento/i }));
  await usuario.upload(screen.getByLabelText(/pdf do acordo/i), pdf);
}

describe("Leitura do PDF de parcelamento no Editar cliente", () => {
  beforeEach(() => {
    lerMock.mockReset();
    salvarParcelamentosMock.mockReset();
    editarMock.mockReset();
    editarMock.mockResolvedValue(ok({ clienteId: dados.id }));
    salvarParcelamentosMock.mockResolvedValue(ok(undefined));
  });

  it("enquanto lê: avisa, desabilita os campos da linha e o Salvar; depois sugere e libera", async () => {
    let terminar!: (v: unknown) => void;
    lerMock.mockReturnValue(new Promise((resolve) => (terminar = resolve)));
    const usuario = userEvent.setup();
    render();

    await anexarPdfNoParcelamentoNovo(usuario);

    expect(await screen.findByText("Lendo o PDF…")).toBeInTheDocument();
    expect(screen.getByLabelText(/código/i)).toBeDisabled();
    expect(screen.getByLabelText(/parcelas restantes/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /salvar/i })).toBeDisabled();

    terminar(
      okAction({ lido: true, codigo: "A-77", codigoGerado: false, quantidadeDeParcelas: 7 }),
    );

    expect(await screen.findByText("Sugerido pelo PDF: confira")).toBeInTheDocument();
    expect(screen.getByLabelText(/código/i)).toHaveValue("A-77");
    expect(screen.getByLabelText(/parcelas restantes/i)).toHaveValue(7);
    expect(screen.getByLabelText(/código/i)).toBeEnabled();
    expect(screen.getByRole("button", { name: /salvar/i })).toBeEnabled();
  });

  it("a sugestão é editável: o valor corrigido é o que vai para o servidor", async () => {
    lerMock.mockResolvedValue(
      okAction({ lido: true, codigo: "A-77", codigoGerado: false, quantidadeDeParcelas: 7 }),
    );
    const usuario = userEvent.setup();
    render();
    await anexarPdfNoParcelamentoNovo(usuario);
    await screen.findByText("Sugerido pelo PDF: confira");

    await usuario.clear(screen.getByLabelText(/parcelas restantes/i));
    await usuario.type(screen.getByLabelText(/parcelas restantes/i), "5");
    await usuario.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() => expect(salvarParcelamentosMock).toHaveBeenCalled());
    expect(salvarParcelamentosMock.mock.calls[0][0].parcelamentos[0]).toMatchObject({
      codigo: "A-77",
      parcelasRestantes: 5,
    });
  });

  it("PDF sem código: avisa que o código foi gerado e pode ser trocado", async () => {
    lerMock.mockResolvedValue(
      okAction({
        lido: true,
        codigo: "PARC-1A2B3C4D",
        codigoGerado: true,
        quantidadeDeParcelas: 7,
      }),
    );
    const usuario = userEvent.setup();
    render();

    await anexarPdfNoParcelamentoNovo(usuario);

    expect(await screen.findByText(/o PDF não traz código/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/código/i)).toHaveValue("PARC-1A2B3C4D");
  });

  describe("dados do acordo e conferência do CNPJ", () => {
    const sugestao = (extra: Record<string, unknown> = {}) =>
      okAction({
        lido: true,
        codigo: "15014167",
        codigoGerado: false,
        quantidadeDeParcelas: 5,
        cnpjConfere: true,
        acordo: {
          origem: "pgfn",
          totalDeParcelas: 5,
          valorDaParcelaCentavos: 26289,
          dataDeAdesao: "2026-01-27",
        },
        ...extra,
      });

    it("lê pelo Cliente da tela e mostra o resumo do acordo; salvar leva o acordo junto", async () => {
      lerMock.mockResolvedValue(sugestao());
      const usuario = userEvent.setup();
      render();

      await anexarPdfNoParcelamentoNovo(usuario);

      expect(
        await screen.findByText(/PGFN · 5 parcelas · R\$\s?262,89 · adesão 27\/01\/2026/),
      ).toBeInTheDocument();
      expect(lerMock.mock.calls[0][0]).toMatchObject({ clienteId: dados.id });
      expect(screen.queryByText(/CNPJ do PDF/i)).not.toBeInTheDocument();

      await usuario.click(screen.getByRole("button", { name: /salvar/i }));
      await waitFor(() => expect(salvarParcelamentosMock).toHaveBeenCalled());
      expect(salvarParcelamentosMock.mock.calls[0][0].parcelamentos[0].acordo).toEqual({
        origem: "pgfn",
        totalDeParcelas: 5,
        valorDaParcelaCentavos: 26289,
        dataDeAdesao: "2026-01-27",
      });
    });

    it("CNPJ do PDF diferente do Cliente: avisa para conferir, sem bloquear o salvar", async () => {
      lerMock.mockResolvedValue(sugestao({ cnpjConfere: false }));
      const usuario = userEvent.setup();
      render();

      await anexarPdfNoParcelamentoNovo(usuario);

      expect(
        await screen.findByText(/o CNPJ do PDF não confere com o do Cliente/i),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /salvar/i })).toBeEnabled();
    });
  });

  it.each([
    [
      "leitura que falha",
      () => lerMock.mockResolvedValue(okAction({ lido: false, motivo: "ilegivel" })),
    ],
    ["Server Action que rejeita", () => lerMock.mockRejectedValue(new Error("rede"))],
  ])(
    "%s: 'não consegui ler: digite à mão', campos livres e o salvar segue possível",
    async (_n, preparar) => {
      preparar();
      const usuario = userEvent.setup();
      render();
      await anexarPdfNoParcelamentoNovo(usuario);

      expect(await screen.findByText("não consegui ler: digite à mão")).toBeInTheDocument();
      expect(screen.getByLabelText(/código/i)).toBeEnabled();
      expect(screen.getByRole("button", { name: /salvar/i })).toBeEnabled();

      await usuario.type(screen.getByLabelText(/código/i), "MANUAL-9");
      await usuario.click(screen.getByRole("button", { name: /salvar/i }));

      await waitFor(() => expect(salvarParcelamentosMock).toHaveBeenCalled());
      expect(salvarParcelamentosMock.mock.calls[0][0].parcelamentos[0].codigo).toBe("MANUAL-9");
    },
  );
});
