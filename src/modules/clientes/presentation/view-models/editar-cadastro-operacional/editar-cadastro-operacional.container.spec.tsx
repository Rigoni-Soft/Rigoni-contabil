import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as renderRtl, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CadastroOperacionalClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { EditarCadastroOperacionalContainer } from "./editar-cadastro-operacional.container";

const routerPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: jest.fn() }),
}));

const executeMock = jest.fn();

const atribuirMock = jest.fn();
const listarMock = jest.fn();
jest.mock("@/main/clientes.factory", () => ({
  makeEditarCadastroOperacionalCliente: () => ({ execute: executeMock }),
  makeAtribuirResponsavelCliente: () => ({ execute: atribuirMock }),
  makeListarResponsaveisElegiveis: () => ({ execute: listarMock }),
  makeListarDocumentosContratuaisCliente: () => ({
    execute: async () => ok([]),
  }),
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
  temParcelamento: false,
  parcelamentoStatus: null,
  observacoesGerais: "Cliente pontual.",
  atividadeMes: { industria: false, comercio: true, servico: false },
  responsavelId: null,
  responsavelNome: null,
};

// Sem retry: o backoff do React Query travaria os findBy.
function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderRtl(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("EditarCadastroOperacionalContainer", () => {
  beforeEach(() => {
    executeMock.mockReset();
    atribuirMock.mockReset();
    listarMock.mockReset();
    listarMock.mockResolvedValue(
      ok([{ id: "f1111111-1111-4111-8111-111111111111", nome: "Funcionário SN" }]),
    );
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

  it("Responsável: sem permissão mostra o nome (campo desabilitado); Líder escolhe e salva via atribuir", async () => {
    const { unmount } = render(
      <EditarCadastroOperacionalContainer dados={dados} readOnly={false} />,
    );
    expect(screen.getByLabelText("Responsável")).toBeDisabled();
    expect(screen.getByLabelText("Responsável")).toHaveValue("Sem responsável");
    unmount();

    executeMock.mockResolvedValue(ok({ clienteId: dados.id }));
    atribuirMock.mockResolvedValue(ok({ clienteId: dados.id }));
    render(
      <EditarCadastroOperacionalContainer
        dados={dados}
        readOnly={false}
        podeAtribuirResponsavel
        voltarHrefAoSalvar="/simples-nacional"
      />,
    );
    // Lista só é buscada quando o Select recebe foco/abre.
    expect(listarMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByLabelText("Responsável"));
    await screen.findByRole("option", { name: "Funcionário SN" });
    expect(listarMock).toHaveBeenCalledTimes(1);
    await userEvent.selectOptions(
      screen.getByLabelText("Responsável"),
      "f1111111-1111-4111-8111-111111111111",
    );
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(atribuirMock).toHaveBeenCalledWith({
        clienteId: dados.id,
        responsavelId: "f1111111-1111-4111-8111-111111111111",
      }),
    );
    expect(routerPush).toHaveBeenCalledWith("/simples-nacional");
  });

  it("Responsável: falha ao carregar a lista mostra aviso com Tentar de novo, que busca de novo", async () => {
    listarMock.mockResolvedValueOnce(err(new ForbiddenError("falhou")));
    render(
      <EditarCadastroOperacionalContainer dados={dados} readOnly={false} podeAtribuirResponsavel />,
    );

    await userEvent.click(screen.getByLabelText("Responsável"));
    expect(await screen.findByText(/Não foi possível carregar a lista/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByRole("option", { name: "Funcionário SN" })).toBeInTheDocument();
    expect(listarMock).toHaveBeenCalledTimes(2);
  });

  it("Responsável: erro ao atribuir mostra a mensagem e não navega", async () => {
    executeMock.mockResolvedValue(ok({ clienteId: dados.id }));
    atribuirMock.mockResolvedValue(err(new ForbiddenError("Só o Líder atribui.")));
    render(
      <EditarCadastroOperacionalContainer
        dados={dados}
        readOnly={false}
        podeAtribuirResponsavel
        voltarHrefAoSalvar="/simples-nacional"
      />,
    );
    await userEvent.click(screen.getByLabelText("Responsável"));
    await screen.findByRole("option", { name: "Funcionário SN" });
    await userEvent.selectOptions(
      screen.getByLabelText("Responsável"),
      "f1111111-1111-4111-8111-111111111111",
    );
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText(/Os dados foram salvos, mas não foi possível atribuir/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Só o Líder atribui./)).toBeInTheDocument();
    expect(routerPush).not.toHaveBeenCalled();
  });

  describe("retry depois de salvar o cadastro e falhar só a atribuição", () => {
    async function falharAtribuicao() {
      executeMock.mockResolvedValue(ok({ clienteId: dados.id }));
      atribuirMock.mockResolvedValueOnce(err(new ForbiddenError("Só o Líder atribui.")));
      render(
        <EditarCadastroOperacionalContainer
          dados={dados}
          readOnly={false}
          podeAtribuirResponsavel
          voltarHrefAoSalvar="/simples-nacional"
        />,
      );
      await userEvent.click(screen.getByLabelText("Responsável"));
      await screen.findByRole("option", { name: "Funcionário SN" });
      await userEvent.selectOptions(
        screen.getByLabelText("Responsável"),
        "f1111111-1111-4111-8111-111111111111",
      );
      await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
      await screen.findByText(/Os dados foram salvos, mas não foi possível atribuir/);
    }

    it("o segundo clique repete só a atribuição, sem chamar a edição de novo", async () => {
      await falharAtribuicao();
      atribuirMock.mockResolvedValue(ok(undefined));

      await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

      await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/simples-nacional"));
      expect(executeMock).toHaveBeenCalledTimes(1);
      expect(atribuirMock).toHaveBeenCalledTimes(2);
    });

    it("atribuição que rejeita por transporte também não faz o segundo clique regravar o cadastro", async () => {
      executeMock.mockResolvedValue(ok({ clienteId: dados.id }));
      atribuirMock.mockRejectedValueOnce(new Error("rede"));
      render(
        <EditarCadastroOperacionalContainer
          dados={dados}
          readOnly={false}
          podeAtribuirResponsavel
          voltarHrefAoSalvar="/simples-nacional"
        />,
      );
      await userEvent.click(screen.getByLabelText("Responsável"));
      await screen.findByRole("option", { name: "Funcionário SN" });
      await userEvent.selectOptions(
        screen.getByLabelText("Responsável"),
        "f1111111-1111-4111-8111-111111111111",
      );
      await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
      expect(
        await screen.findByText(/Os dados foram salvos, mas não foi possível atribuir/),
      ).toBeInTheDocument();
      atribuirMock.mockResolvedValue(ok(undefined));

      await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

      await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/simples-nacional"));
      expect(executeMock).toHaveBeenCalledTimes(1);
      expect(atribuirMock).toHaveBeenCalledTimes(2);
    });

    it("se outro campo mudou entre as tentativas, o salvamento completo volta", async () => {
      await falharAtribuicao();
      atribuirMock.mockResolvedValue(ok(undefined));

      await userEvent.type(screen.getByLabelText(/observações gerais/i), " Mais um detalhe.");
      await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

      await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/simples-nacional"));
      expect(executeMock).toHaveBeenCalledTimes(2);
    });
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

  it("DAS: 'Enviado' não é opção escolhível; a data de envio é sempre só leitura e desativada (#108)", () => {
    render(<EditarCadastroOperacionalContainer dados={dados} readOnly={false} />);

    expect(screen.queryByRole("option", { name: "Enviado" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("DAS")).toBeEnabled();
    const data = screen.getByLabelText(/data de envio/i);
    expect(data).toHaveAttribute("readonly");
    expect(data).toBeDisabled();
  });

  it("DAS já enviado pelo sistema: 'Enviado' e a data aparecem, mas o campo DAS fica desativado", () => {
    render(
      <EditarCadastroOperacionalContainer
        dados={{ ...dados, dasStatus: "enviado", dataEnvioDas: "2026-10-05" }}
        readOnly={false}
      />,
    );

    const das = screen.getByLabelText("DAS");
    expect(das).toHaveValue("enviado");
    expect(das).toBeDisabled();
    expect(screen.getByLabelText(/data de envio/i)).toHaveValue("2026-10-05");
    expect(screen.getByLabelText(/data de envio/i)).toBeDisabled();
  });

  it("modo readOnly não oferece adicionar nem remover contato", () => {
    render(<EditarCadastroOperacionalContainer dados={dados} readOnly />);

    expect(screen.getByLabelText(/^Nome/, { selector: "input" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Adicionar contato" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remover contato/i })).not.toBeInTheDocument();
  });

  it("editando, adicionar e remover contato continuam disponíveis", () => {
    render(<EditarCadastroOperacionalContainer dados={dados} readOnly={false} />);

    expect(screen.getByRole("button", { name: "Adicionar contato" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Remover contato 1" })).toBeEnabled();
  });

  it("no HTML do servidor o formulário vem oculto até hidratar (sem placeholders no lugar dos valores)", () => {
    const client = new QueryClient();
    const html = renderToString(
      <QueryClientProvider client={client}>
        <EditarCadastroOperacionalContainer dados={dados} readOnly={false} />
      </QueryClientProvider>,
    );

    const abertura = html.match(/<form[^>]*>/)?.[0] ?? "";
    expect(abertura).toContain("rc-oculto-ate-hidratar");
  });

  it("depois de hidratar, o formulário fica visível", () => {
    const { container } = render(
      <EditarCadastroOperacionalContainer dados={dados} readOnly={false} />,
    );

    expect(container.querySelector("form")).not.toHaveClass("rc-oculto-ate-hidratar");
  });

  it("Empresa, CNPJ, Regime e Responsável têm rótulo ligado ao campo e estão desativados", () => {
    render(<EditarCadastroOperacionalContainer dados={dados} readOnly={false} />);

    for (const [rotulo, valor] of [
      ["Empresa", "Padaria Pão Quente Ltda"],
      ["CNPJ", "11444777000161"],
      ["Regime", "Simples Nacional"],
      ["Responsável", "Sem responsável"],
    ]) {
      const campo = screen.getByLabelText(rotulo, { selector: "input" });
      expect(campo).toBeDisabled();
      expect(campo).toHaveValue(valor);
    }
  });

  it("explica por que a data de envio e o DAS enviado estão travados", () => {
    const { unmount } = render(
      <EditarCadastroOperacionalContainer dados={dados} readOnly={false} />,
    );

    expect(screen.getByLabelText(/data de envio/i)).toHaveAccessibleDescription(
      "Preenchida pelo sistema quando o DAS é enviado.",
    );
    // DAS ainda editável: sem texto de "travado".
    expect(screen.getByLabelText("DAS")).not.toHaveAccessibleDescription();
    unmount();

    render(
      <EditarCadastroOperacionalContainer
        dados={{ ...dados, dasStatus: "enviado", dataEnvioDas: "2026-10-05" }}
        readOnly={false}
      />,
    );
    expect(screen.getByLabelText("DAS")).toHaveAccessibleDescription("Definido pelo sistema.");
  });

  it("salvar com DAS já enviado mantém 'enviado' e a data no que vai ao servidor", async () => {
    executeMock.mockResolvedValue({ ok: true, value: { clienteId: dados.id } });
    const usuario = userEvent.setup();
    render(
      <EditarCadastroOperacionalContainer
        dados={{ ...dados, dasStatus: "enviado", dataEnvioDas: "2026-10-05" }}
        readOnly={false}
      />,
    );

    await usuario.click(screen.getByRole("button", { name: /salvar/i }));

    await screen.findByText(/atualizado/i);
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({ dasStatus: "enviado", dataEnvioDas: "2026-10-05" }),
    );
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

  it("Promise rejeitada da Server Action não prende o botão em 'Salvando...'", async () => {
    executeMock.mockRejectedValue(new Error("falha de rede"));
    const usuario = userEvent.setup();
    render(<EditarCadastroOperacionalContainer dados={dados} readOnly={false} />);

    await usuario.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText(/Não foi possível salvar agora/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /salvar/i })).toBeEnabled();
  });

  // Tela própria (/clientes/[id]) navega de volta pro lugar certo depois de
  // salvar, em vez de ficar parada no form.
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
