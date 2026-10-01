import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CadastroOperacionalClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";

import { EditarCadastroOperacionalContainer } from "./editar-cadastro-operacional.container";

const routerPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: jest.fn() }),
}));

const executeMock = jest.fn();

jest.mock("@/main/clientes.factory", () => ({
  makeEditarCadastroOperacionalCliente: () => ({ execute: executeMock }),
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
  temParcelamento: false,
  parcelamentoStatus: null,
  observacoesGerais: "Cliente pontual.",
  atividadeMes: { industria: false, comercio: true, servico: false },
};

describe("EditarCadastroOperacionalContainer", () => {
  beforeEach(() => {
    executeMock.mockReset();
    routerPush.mockReset();
  });

  it.each([
    ["lucro_presumido", "Lucro Presumido"],
    ["lucro_real", "Lucro Real"],
  ])("Regime %s: avisa que não se aplica e não renderiza o formulário", (regime, rotulo) => {
    render(<EditarCadastroOperacionalContainer dados={{ ...dados, regime }} readOnly={false} />);

    expect(screen.getByRole("status")).toHaveTextContent(`não se aplica ao Regime ${rotulo}`);
    expect(screen.queryByRole("button", { name: /salvar/i })).not.toBeInTheDocument();
  });

  it("modo readOnly: nunca renderiza contrato social/alterações e não mostra Salvar/Limpar/Cancelar", () => {
    render(<EditarCadastroOperacionalContainer dados={dados} readOnly />);

    expect(screen.queryByText(/contrato social/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/alteraç(ão|ões) contratua/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /salvar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /limpar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /cancelar/i })).not.toBeInTheDocument();
  });

  it("modo edição: campos ficam habilitados e os botões Salvar/Limpar/Cancelar aparecem", () => {
    render(<EditarCadastroOperacionalContainer dados={dados} readOnly={false} />);

    expect(screen.getByLabelText(/forma de envio/i)).toBeEnabled();
    expect(screen.getByRole("button", { name: /salvar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /limpar/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /cancelar/i })).toHaveAttribute("href", "/");
  });

  it("'Limpar' desfaz uma edição não salva, voltando ao valor carregado do servidor", async () => {
    const usuario = userEvent.setup();
    render(<EditarCadastroOperacionalContainer dados={dados} readOnly={false} />);

    await usuario.clear(screen.getByLabelText(/observações gerais/i));
    await usuario.type(screen.getByLabelText(/observações gerais/i), "Rascunho não salvo.");
    await usuario.click(screen.getByRole("button", { name: /limpar/i }));

    expect(screen.getByLabelText(/observações gerais/i)).toHaveValue("Cliente pontual.");
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("submete os dados editados e mostra confirmação", async () => {
    executeMock.mockResolvedValue({ ok: true, value: { clienteId: dados.id } });
    const usuario = userEvent.setup();
    render(<EditarCadastroOperacionalContainer dados={dados} readOnly={false} />);

    await usuario.clear(screen.getByLabelText(/observações gerais/i));
    await usuario.type(screen.getByLabelText(/observações gerais/i), "Atualizado.");
    await usuario.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText(/atualizado/i)).toBeInTheDocument();
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: dados.id, observacoesGerais: "Atualizado." }),
    );
  });

  it("Promise rejeitada da Server Action não prende o botão em 'Salvando...' (PR #69, ponto 6)", async () => {
    executeMock.mockRejectedValue(new Error("falha de rede"));
    const usuario = userEvent.setup();
    render(<EditarCadastroOperacionalContainer dados={dados} readOnly={false} />);

    await usuario.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText(/Não foi possível salvar agora/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /salvar/i })).toBeEnabled();
  });

  // Feedback de teste manual do #36: tela própria (/clientes/[id]) navega de
  // volta pro lugar certo depois de salvar, em vez de ficar parada no form.
  it("com voltarHrefAoSalvar, navega pra lá depois de salvar com sucesso", async () => {
    executeMock.mockResolvedValue({ ok: true, value: { clienteId: dados.id } });
    const usuario = userEvent.setup();
    render(
      <EditarCadastroOperacionalContainer
        dados={dados}
        readOnly={false}
        voltarHrefAoSalvar="/clientes/resumo/sem_documento"
      />,
    );

    await usuario.click(screen.getByRole("button", { name: /salvar/i }));

    await screen.findByText(/atualizado/i);
    expect(routerPush).toHaveBeenCalledWith("/clientes/resumo/sem_documento");
  });

  // Painel embutido no dashboard (busca do /simples-nacional): quem decide o
  // "fechar/voltar" é o consumidor (fecha o painel + atualiza a página), não
  // uma navegação fixa — aoSalvarComSucesso tem prioridade sobre voltarHref.
  it("com aoSalvarComSucesso, chama o callback em vez de navegar", async () => {
    executeMock.mockResolvedValue({ ok: true, value: { clienteId: dados.id } });
    const aoSalvarComSucesso = jest.fn();
    const usuario = userEvent.setup();
    render(
      <EditarCadastroOperacionalContainer
        dados={dados}
        readOnly={false}
        voltarHrefAoSalvar="/nunca-deveria-navegar-pra-ca"
        aoSalvarComSucesso={aoSalvarComSucesso}
      />,
    );

    await usuario.click(screen.getByRole("button", { name: /salvar/i }));

    await screen.findByText(/atualizado/i);
    expect(aoSalvarComSucesso).toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("cliente não encontrado: mostra mensagem em vez do formulário", () => {
    render(<EditarCadastroOperacionalContainer dados={null} readOnly={false} />);

    expect(screen.getByText(/cliente não encontrado/i)).toBeInTheDocument();
  });
});
