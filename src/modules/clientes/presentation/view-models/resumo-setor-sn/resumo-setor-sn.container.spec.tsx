import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ResumoSetorSnDto } from "@/modules/clientes/application/ports/in/obter-resumo-setor-sn.provider";
import type { CadastroOperacionalClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";

import { ResumoSetorSnContainer } from "./resumo-setor-sn.container";

const carregarCadastroOperacionalActionMock = jest.fn();

jest.mock(
  "@/modules/clientes/presentation/view-models/buscar-cliente/buscar-cliente.actions",
  () => ({
    carregarCadastroOperacionalAction: (id: string) => carregarCadastroOperacionalActionMock(id),
  }),
);

jest.mock("@/main/clientes.factory", () => ({
  makeEditarCadastroOperacionalCliente: () => ({ execute: jest.fn() }),
}));

const CADASTRO: CadastroOperacionalClienteDto = {
  id: "cliente-1",
  empresa: "Padaria Pão Quente Ltda",
  cnpj: "11444777000161",
  regime: "simples_nacional",
  formaEnvio: "whatsapp",
  contatos: [],
  documentoObrigatorio: "positivo",
  dasStatus: "pendente",
  dataEnvioDas: null,
  temParcelamento: false,
  parcelamentoStatus: null,
  observacoesGerais: "",
  atividadeMes: { industria: false, comercio: false, servico: false },
};

const RESUMO: ResumoSetorSnDto = {
  totalClientes: 1,
  cards: [
    {
      id: "das_pendente",
      titulo: "DAS pendente",
      cor: "urgente",
      quantidade: 1,
      clientes: [
        { clienteId: "cliente-1", empresa: "Padaria Pão Quente Ltda", cnpj: "11444777000161" },
      ],
    },
    { id: "das_emitidas", titulo: "DAS emitidas", cor: "em_dia", quantidade: 0, clientes: [] },
  ],
};

describe("ResumoSetorSnContainer", () => {
  beforeEach(() => carregarCadastroOperacionalActionMock.mockReset());

  it("mostra os cards com a proporção de cada bucket", () => {
    render(<ResumoSetorSnContainer initialData={RESUMO} papel="admin" setor="administrativo" />);

    expect(screen.getByText("DAS pendente")).toBeInTheDocument();
    expect(screen.getByText("1 de 1")).toBeInTheDocument();
    expect(screen.getByText("0 de 1")).toBeInTheDocument();
  });

  it("clicar num card abre o drill-down com os clientes daquele bucket", async () => {
    const usuario = userEvent.setup();
    render(<ResumoSetorSnContainer initialData={RESUMO} papel="admin" setor="administrativo" />);

    await usuario.click(screen.getByRole("button", { name: /DAS pendente/i }));

    expect(screen.getByText("11.444.777/0001-61")).toBeInTheDocument();
  });

  it("clicar em 'Ver cadastro' abre o painel de edição inline do cliente", async () => {
    carregarCadastroOperacionalActionMock.mockResolvedValue({ ok: true, data: CADASTRO });
    const usuario = userEvent.setup();
    render(<ResumoSetorSnContainer initialData={RESUMO} papel="admin" setor="administrativo" />);

    await usuario.click(screen.getByRole("button", { name: /DAS pendente/i }));
    await usuario.click(screen.getByRole("button", { name: "Ver cadastro" }));

    expect(await screen.findByText("Editar cadastro operacional")).toBeInTheDocument();
    expect(carregarCadastroOperacionalActionMock).toHaveBeenCalledWith("cliente-1");
  });

  it("'Voltar ao resumo' fecha o painel e volta pros cards", async () => {
    carregarCadastroOperacionalActionMock.mockResolvedValue({ ok: true, data: CADASTRO });
    const usuario = userEvent.setup();
    render(<ResumoSetorSnContainer initialData={RESUMO} papel="admin" setor="administrativo" />);

    await usuario.click(screen.getByRole("button", { name: /DAS pendente/i }));
    await usuario.click(screen.getByRole("button", { name: "Ver cadastro" }));
    await screen.findByText("Editar cadastro operacional");
    await usuario.click(screen.getByRole("button", { name: "Voltar ao resumo" }));

    expect(screen.getByText("Resumo do setor")).toBeInTheDocument();
  });

  it("falha ao carregar o cadastro mostra um erro em vez de ficar em silêncio", async () => {
    carregarCadastroOperacionalActionMock.mockResolvedValue({
      ok: false,
      error: { code: "PERSISTENCIA_ERROR", message: "indisponível" },
    });
    const usuario = userEvent.setup();
    render(<ResumoSetorSnContainer initialData={RESUMO} papel="admin" setor="administrativo" />);

    await usuario.click(screen.getByRole("button", { name: /DAS pendente/i }));
    await usuario.click(screen.getByRole("button", { name: "Ver cadastro" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falha ao carregar o cadastro. Tente novamente.",
    );
    expect(screen.getByText("Resumo do setor")).toBeInTheDocument();
  });

  it("Funcionário fora do Simples Nacional vê o painel em modo leitura", async () => {
    carregarCadastroOperacionalActionMock.mockResolvedValue({ ok: true, data: CADASTRO });
    const usuario = userEvent.setup();
    render(<ResumoSetorSnContainer initialData={RESUMO} papel="funcionario" setor="financeiro" />);

    await usuario.click(screen.getByRole("button", { name: /DAS pendente/i }));
    await usuario.click(screen.getByRole("button", { name: "Ver cadastro" }));

    expect(await screen.findByText("Visualizar cadastro operacional")).toBeInTheDocument();
  });
});
