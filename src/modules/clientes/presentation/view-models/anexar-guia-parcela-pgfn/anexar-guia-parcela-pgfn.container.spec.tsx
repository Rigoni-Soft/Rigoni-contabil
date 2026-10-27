import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render as renderRtl,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CadastroOperacionalClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { GuiaDaParcela } from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import { ok } from "@/shared/kernel/result";

import { EditarCadastroOperacionalContainer } from "../editar-cadastro-operacional/editar-cadastro-operacional.container";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("@/main/clientes.factory", () => ({
  makeListarDocumentosContratuaisCliente: () => ({ execute: async () => ok([]) }),
  makeObterLinkDocumentoContratual: () => ({ execute: jest.fn() }),
}));

// As actions têm teste próprio; aqui a tela é testada contra o contrato delas.
const anexarMock = jest.fn();
const confirmarMock = jest.fn();
const listarMock = jest.fn();
const trocarMock = jest.fn();
const removerMock = jest.fn();
const obterLinkMock = jest.fn();
jest.mock("./anexar-guia-parcela-pgfn.actions", () => ({
  trocarGuiaParcelaPgfnAction: (...args: unknown[]) => trocarMock(...args),
  removerGuiaParcelaPgfnAction: (...args: unknown[]) => removerMock(...args),
  obterLinkGuiaParcelaPgfnAction: (...args: unknown[]) => obterLinkMock(...args),
  anexarGuiaParcelaPgfnAction: (...args: unknown[]) => anexarMock(...args),
  confirmarGuiaParcelaPgfnAction: (...args: unknown[]) => confirmarMock(...args),
  listarGuiasParcelaPgfnAction: (...args: unknown[]) => listarMock(...args),
}));

const PARCELAMENTO_PGFN = "11111111-1111-4111-8111-111111111111";

const parcelamento = (id: string, origem: "pgfn" | "receita_federal", codigo: string) => ({
  id,
  codigo,
  parcelasRestantes: 3,
  interno: false,
  quitado: false,
  temEnvio: false,
  enviadoNoMes: false,
  arquivoNome: "acordo.pdf",
  acordo: { origem, totalDeParcelas: 12, valorDaParcelaCentavos: 10000, dataDeAdesao: null },
});

const dados = {
  id: "9f1c9c6e-9d1a-4c9a-8b1e-2e2a4a5b6c7d",
  empresa: "Padaria Pão Quente Ltda",
  cnpj: "11444777000161",
  regime: "simples_nacional",
  formaEnvio: "whatsapp",
  contatos: [{ id: "c1", nome: "Maria", telefone: "11999990000", padrao: true }],
  documentoObrigatorio: "positivo",
  dasStatus: "pronto",
  dataEnvioDas: null,
  parcelamentos: [
    parcelamento(PARCELAMENTO_PGFN, "pgfn", "PGFN-1"),
    parcelamento("22222222-2222-4222-8222-222222222222", "receita_federal", "RF-1"),
  ],
  observacoesGerais: "",
  atividadeMes: { industria: false, comercio: true, servico: false },
  responsavelId: null,
  responsavelNome: null,
} as CadastroOperacionalClienteDto;

const pdf = new File([new Uint8Array([1, 2, 3])], "guia.pdf", { type: "application/pdf" });

function render(readOnly = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderRtl(
    <QueryClientProvider client={client}>
      <EditarCadastroOperacionalContainer dados={dados} readOnly={readOnly} />
    </QueryClientProvider>,
  );
}

const regiaoDaGuia = () => screen.findByRole("group", { name: "Guias da parcela PGFN-1" });

const NOME_CONFIRMAR = "Confirmar e liberar guia de 10/2026 ao envio";
const NOME_LIBERAR = "Liberar 10/2026 ao envio";

// Confirmar libera a guia ao Cliente: abre a conferência e só a segunda ação chama o servidor.
async function liberarGuia(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(await screen.findByRole("button", { name: NOME_CONFIRMAR }));
  await usuario.click(screen.getByRole("button", { name: NOME_LIBERAR }));
}

async function preencherEAnexar(usuario: ReturnType<typeof userEvent.setup>) {
  const regiao = within(await regiaoDaGuia());
  await usuario.type(regiao.getByLabelText(/competência/i), "2026-10");
  await usuario.type(regiao.getByLabelText(/conta de negociação/i), "123456");
  await usuario.upload(regiao.getByLabelText(/pdf da guia/i), pdf);
  await usuario.click(regiao.getByRole("button", { name: "Anexar guia" }));
}

describe("guia da parcela PGFN na linha do Parcelamento", () => {
  beforeEach(() => {
    anexarMock.mockReset();
    confirmarMock.mockReset();
    listarMock.mockReset();
    listarMock.mockResolvedValue({ ok: true, data: [] });
  });

  it("só o Parcelamento PGFN já salvo tem o campo; o da Receita e a visualização não", async () => {
    render();

    expect(await regiaoDaGuia()).toBeInTheDocument();
    expect(screen.getAllByRole("group", { name: "Guias da parcela PGFN-1" })).toHaveLength(1);
    expect(listarMock).toHaveBeenCalledWith({ parcelamentoId: PARCELAMENTO_PGFN });
  });

  it("visualização (somente leitura) não mostra o campo de anexar", () => {
    render(true);

    expect(
      screen.queryByRole("group", { name: "Guias da parcela PGFN-1" }),
    ).not.toBeInTheDocument();
  });

  it("anexa: manda competência AAAAMM, conta e PDF; a guia aparece a confirmar", async () => {
    const guia: GuiaDaParcela = {
      competencia: "202610",
      contaNegociacao: "123456",
      estado: "a_confirmar",
    };
    anexarMock.mockResolvedValue({ ok: true, data: guia });
    const usuario = userEvent.setup();
    render();
    await regiaoDaGuia();
    listarMock.mockResolvedValue({ ok: true, data: [guia] });

    await preencherEAnexar(usuario);

    expect(anexarMock).toHaveBeenCalledWith({
      parcelamentoId: PARCELAMENTO_PGFN,
      competencia: "202610",
      contaNegociacao: "123456",
      arquivo: pdf,
    });
    expect(await screen.findByText(/10\/2026 · conta 123456/)).toBeInTheDocument();
    expect(screen.getByText("A confirmar")).toBeInTheDocument();
    expect(screen.getByText(/guia anexada/i)).toBeInTheDocument();
  });

  it("a lista mostra o motivo da guia a confirmar, e não o da confirmada", async () => {
    listarMock.mockResolvedValue({
      ok: true,
      data: [
        {
          competencia: "202610",
          contaNegociacao: "999",
          estado: "a_confirmar",
          motivo: "A conta do PDF (999) é diferente da conta do Parcelamento (PGFN-1).",
        },
        { competencia: "202609", contaNegociacao: "123456", estado: "confirmada" },
      ],
    });
    render();

    expect(await screen.findByText(/conta do PDF .999. é diferente/)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    // Quem confirma com leitor de tela ouve o que conferir junto do botão.
    expect(
      screen.getByRole("button", { name: "Confirmar e liberar guia de 10/2026 ao envio" }),
    ).toHaveAccessibleDescription(/conta do PDF .999. é diferente/);
  });

  it("confirma à mão: chama a action e a guia passa a confirmada, sem botão", async () => {
    listarMock.mockResolvedValue({
      ok: true,
      data: [{ competencia: "202610", contaNegociacao: "123456", estado: "a_confirmar" }],
    });
    confirmarMock.mockResolvedValue({ ok: true, data: undefined });
    const usuario = userEvent.setup();
    render();
    await screen.findByRole("button", { name: NOME_CONFIRMAR });
    listarMock.mockResolvedValue({
      ok: true,
      data: [{ competencia: "202610", contaNegociacao: "123456", estado: "confirmada" }],
    });

    await liberarGuia(usuario);

    expect(confirmarMock).toHaveBeenCalledWith({
      parcelamentoId: PARCELAMENTO_PGFN,
      competencia: "202610",
    });
    expect(await screen.findByText("Liberada ao envio")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirmar guia/i })).not.toBeInTheDocument();
    // O botão sumiu: o foco vai ao item da guia, não cai no topo da página.
    expect(screen.getByText(/10\/2026 · conta 123456/).closest("li")).toHaveFocus();
  });

  it("a guia mais nova e as a confirmar ficam à vista; as outras, recolhidas em Ver histórico", async () => {
    listarMock.mockResolvedValue({
      ok: true,
      data: [
        { competencia: "202608", contaNegociacao: "123456", estado: "confirmada", enviada: true },
        { competencia: "202609", contaNegociacao: "123456", estado: "confirmada" },
        { competencia: "202610", contaNegociacao: "123456", estado: "confirmada" },
      ],
    });
    render();
    const regiao = within(await regiaoDaGuia());

    const resumo = await regiao.findByText("Ver histórico (2)");
    const historico = resumo.closest("details") as HTMLElement;
    expect(historico).not.toHaveAttribute("open");
    expect(within(historico).getByText(/08\/2026 · conta 123456/)).toBeInTheDocument();
    expect(within(historico).getByText(/09\/2026 · conta 123456/)).toBeInTheDocument();
    expect(historico).not.toContainElement(regiao.getByText(/10\/2026 · conta 123456/));
    // Guia enviada diz por que não troca nem remove.
    expect(regiao.getByText("Já enviada ao Cliente: só pode ser aberta.")).toBeInTheDocument();
  });

  it("remover mostra Removendo... enquanto o servidor responde", async () => {
    let concluir: (valor: unknown) => void = () => undefined;
    listarMock.mockResolvedValue({
      ok: true,
      data: [{ competencia: "202610", contaNegociacao: "123456", estado: "confirmada" }],
    });
    removerMock.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
    const usuario = userEvent.setup();
    render();
    const regiao = within(await regiaoDaGuia());
    await usuario.click(await regiao.findByRole("button", { name: "Remover guia de 10/2026" }));

    await usuario.click(
      regiao.getByRole("button", { name: "Confirmar remoção da guia de 10/2026" }),
    );

    expect(
      regiao.getByRole("button", { name: "Confirmar remoção da guia de 10/2026" }),
    ).toHaveTextContent("Removendo...");
    concluir({ ok: true, data: undefined });
  });

  it("o resultado de liberar aparece dentro do item da guia agida, não no fim da região", async () => {
    listarMock.mockResolvedValue({
      ok: true,
      data: [
        { competencia: "202609", contaNegociacao: "111", estado: "a_confirmar" },
        { competencia: "202610", contaNegociacao: "222", estado: "a_confirmar" },
      ],
    });
    confirmarMock.mockResolvedValue({ ok: true, data: undefined });
    const usuario = userEvent.setup();
    render();
    const regiao = within(await regiaoDaGuia());
    await usuario.click(
      await regiao.findByRole("button", { name: "Confirmar e liberar guia de 09/2026 ao envio" }),
    );
    await usuario.click(regiao.getByRole("button", { name: "Liberar 09/2026 ao envio" }));

    const aviso = await regiao.findByText("Guia confirmada e liberada ao envio.");
    const itemAgido = regiao.getByText(/09\/2026 · conta 111/).closest("li");
    expect(itemAgido).toContainElement(aviso);
    expect(regiao.getByText(/10\/2026 · conta 222/).closest("li")).not.toContainElement(aviso);
  });

  it("Confirmar e liberar pede conferência: sem confirmar não chama o servidor, e cancelar devolve o foco", async () => {
    listarMock.mockResolvedValue({
      ok: true,
      data: [{ competencia: "202610", contaNegociacao: "123456", estado: "a_confirmar" }],
    });
    const usuario = userEvent.setup();
    render();

    await usuario.click(await screen.findByRole("button", { name: NOME_CONFIRMAR }));

    // Diz o que será liberado (mês, conta), que vai ao Cliente e que não se desfaz.
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Libera a guia de 10\/2026 \(conta 123456\) para envio\. Ela vai ao Cliente pela forma de envio dele .* ou ao financeiro se o Parcelamento for interno\. Não dá para desfazer\./,
    );
    expect(confirmarMock).not.toHaveBeenCalled();
    // Quem abriu sem querer cai no gesto seguro.
    const cancelar = screen.getByRole("button", { name: "Cancelar liberação da guia de 10/2026" });
    expect(cancelar).toHaveFocus();

    await usuario.click(cancelar);

    expect(confirmarMock).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: NOME_CONFIRMAR })).toHaveFocus());
  });

  it("enquanto confirma, o botão diz que está confirmando e a região fica ocupada", async () => {
    listarMock.mockResolvedValue({
      ok: true,
      data: [{ competencia: "202610", contaNegociacao: "123456", estado: "a_confirmar" }],
    });
    let concluir: (valor: { ok: true; data: undefined }) => void = () => undefined;
    confirmarMock.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
    const usuario = userEvent.setup();
    render();

    await liberarGuia(usuario);

    const botao = screen.getByRole("button", { name: NOME_LIBERAR });
    expect(botao).toHaveTextContent("Liberando...");
    expect(await regiaoDaGuia()).toHaveAttribute("aria-busy", "true");
    concluir({ ok: true, data: undefined });
    // Terminou: a conferência fecha.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: NOME_LIBERAR })).not.toBeInTheDocument(),
    );
  });

  it("só o PDF é obrigatório: competência e conta vazias seguem para o servidor ler", async () => {
    anexarMock.mockResolvedValue({
      ok: true,
      data: { competencia: "202610", contaNegociacao: "150141670", estado: "confirmada" },
    });
    const usuario = userEvent.setup();
    render();
    const regiao = within(await regiaoDaGuia());

    await usuario.upload(regiao.getByLabelText(/pdf da guia/i), pdf);
    await usuario.click(regiao.getByRole("button", { name: "Anexar guia" }));

    expect(anexarMock).toHaveBeenCalledWith({
      parcelamentoId: PARCELAMENTO_PGFN,
      competencia: undefined,
      contaNegociacao: undefined,
      arquivo: pdf,
    });
    expect(await screen.findByText(/anexada e confirmada/i)).toBeInTheDocument();
  });

  it("guia que ficou a confirmar mostra o motivo na tela", async () => {
    anexarMock.mockResolvedValue({
      ok: true,
      data: {
        competencia: "202610",
        contaNegociacao: "999",
        estado: "a_confirmar",
        motivo: "A conta do PDF (999) é diferente da conta do Parcelamento (PGFN-1).",
      },
    });
    const usuario = userEvent.setup();
    render();
    const regiao = within(await regiaoDaGuia());

    await usuario.upload(regiao.getByLabelText(/pdf da guia/i), pdf);
    await usuario.click(regiao.getByRole("button", { name: "Anexar guia" }));

    expect(await screen.findByText(/conta do PDF .999. é diferente/)).toBeInTheDocument();
    expect(screen.getByText(/ainda não liberada ao envio/)).toBeInTheDocument();
    // Pede conferência, não comemora: nada de "anexada e confirmada".
    expect(screen.queryByText(/anexada e confirmada/i)).not.toBeInTheDocument();
  });

  it("o aviso do anexo aparece sem esperar a lista recarregar", async () => {
    const guia = {
      competencia: "202610",
      contaNegociacao: "999",
      estado: "a_confirmar",
      motivo: "Conferir a conta.",
    };
    anexarMock.mockResolvedValue({ ok: true, data: guia });
    const usuario = userEvent.setup();
    render();
    const regiao = within(await regiaoDaGuia());
    // A relistagem do anexo nunca responde: o aviso não pode depender dela.
    listarMock.mockReturnValue(new Promise(() => undefined));

    await usuario.upload(regiao.getByLabelText(/pdf da guia/i), pdf);
    await usuario.click(regiao.getByRole("button", { name: "Anexar guia" }));

    expect(await screen.findByText(/ainda não liberada ao envio/)).toBeInTheDocument();
    expect(screen.queryByText("Conferir a conta.")).not.toBeInTheDocument();
  });

  it("lista que chega depois de a pessoa editar um campo não traz o aviso de volta", async () => {
    const guia = {
      competencia: "202610",
      contaNegociacao: "999",
      estado: "a_confirmar",
      motivo: "Conferir a conta.",
    };
    anexarMock.mockResolvedValue({ ok: true, data: guia });
    const usuario = userEvent.setup();
    render();
    const regiao = within(await regiaoDaGuia());
    let chegou: (valor: unknown) => void = () => undefined;
    listarMock.mockReturnValue(new Promise((resolve) => (chegou = resolve)));

    await usuario.upload(regiao.getByLabelText(/pdf da guia/i), pdf);
    await usuario.click(regiao.getByRole("button", { name: "Anexar guia" }));
    expect(await screen.findByText(/ainda não liberada ao envio/)).toBeInTheDocument();
    // Os campos de texto travam durante o envio; o seletor de PDF não, e trocar o arquivo é editar.
    await usuario.upload(regiao.getByLabelText(/pdf da guia/i), pdf);
    expect(screen.queryByText(/ainda não liberada ao envio/)).not.toBeInTheDocument();

    await act(async () => chegou({ ok: true, data: [guia] }));

    expect(screen.queryByText(/ainda não liberada ao envio/)).not.toBeInTheDocument();
    expect(await screen.findByText("Conferir a conta.")).toBeInTheDocument();
  });

  it("com o motivo já na lista, o aviso só aponta para ele (o texto aparece uma vez)", async () => {
    const motivo = "A conta do PDF (999) é diferente da conta do Parcelamento (PGFN-1).";
    const guia = { competencia: "202610", contaNegociacao: "999", estado: "a_confirmar", motivo };
    anexarMock.mockResolvedValue({ ok: true, data: guia });
    const usuario = userEvent.setup();
    render();
    const regiao = within(await regiaoDaGuia());
    listarMock.mockResolvedValue({ ok: true, data: [guia] });

    await usuario.upload(regiao.getByLabelText(/pdf da guia/i), pdf);
    await usuario.click(regiao.getByRole("button", { name: "Anexar guia" }));

    expect(await screen.findByText(/confira o motivo na lista/i)).toBeInTheDocument();
    expect(screen.getAllByText(/conta do PDF .999. é diferente/)).toHaveLength(1);
  });

  it("a nota de que o sistema lê o PDF descreve a competência e a conta", async () => {
    render();
    const regiao = within(await regiaoDaGuia());

    const nota = regiao.getByText("O sistema lê o PDF; digite só se ele não conseguir.");
    expect(regiao.getByLabelText(/competência/i)).toHaveAccessibleDescription(nota.textContent!);
    expect(regiao.getByLabelText(/conta de negociação/i)).toHaveAccessibleDescription(
      nota.textContent!,
    );
  });

  it("campos faltando: aponta o PDF e não chama a action", async () => {
    const usuario = userEvent.setup();
    render();
    const regiao = within(await regiaoDaGuia());

    await usuario.click(regiao.getByRole("button", { name: "Anexar guia" }));

    expect(regiao.getByText("Anexe o PDF da guia.")).toBeInTheDocument();
    expect(anexarMock).not.toHaveBeenCalled();
  });

  it("recusa do servidor (segundo anexo na competência) aparece na linha e mantém o que foi digitado", async () => {
    anexarMock.mockResolvedValue({
      ok: false,
      error: {
        code: "PERSISTENCIA_ERROR",
        message: "Já existe guia anexada para esta competência.",
      },
    });
    const usuario = userEvent.setup();
    render();

    await preencherEAnexar(usuario);

    expect(
      await screen.findByText("Já existe guia anexada para esta competência."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/conta de negociação/i)).toHaveValue("123456");
  });
});

describe("competência digitada sem seletor de mês", () => {
  it("aceita MM/AAAA e manda AAAAMM", async () => {
    anexarMock.mockResolvedValue({
      ok: true,
      data: { competencia: "202610", contaNegociacao: "123456", estado: "a_confirmar" },
    });
    const usuario = userEvent.setup();
    listarMock.mockResolvedValue({ ok: true, data: [] });
    render();
    const regiao = within(await regiaoDaGuia());
    const campo = regiao.getByLabelText(/competência/i);
    // jsdom trata type=month como texto livre, como o Firefox no desktop.
    fireEvent.change(campo, { target: { value: "10/2026" } });
    await usuario.type(regiao.getByLabelText(/conta de negociação/i), "123456");
    await usuario.upload(regiao.getByLabelText(/pdf da guia/i), pdf);
    await usuario.click(regiao.getByRole("button", { name: "Anexar guia" }));

    expect(anexarMock).toHaveBeenCalledWith(expect.objectContaining({ competencia: "202610" }));
  });
});

describe("rótulo do botão durante a ação em curso", () => {
  it("confirmar não faz o botão Anexar dizer que está enviando", async () => {
    listarMock.mockResolvedValue({
      ok: true,
      data: [{ competencia: "202610", contaNegociacao: "123456", estado: "a_confirmar" }],
    });
    let concluir: (valor: unknown) => void = () => undefined;
    confirmarMock.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
    const usuario = userEvent.setup();
    render();

    await liberarGuia(usuario);

    expect(screen.getByRole("button", { name: "Anexar guia" })).toBeInTheDocument();
    expect(screen.queryByText("Enviando...")).not.toBeInTheDocument();
    concluir({ ok: true, data: undefined });
  });

  it("anexar mostra Enviando... enquanto o PDF sobe", async () => {
    let concluir: (valor: unknown) => void = () => undefined;
    anexarMock.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
    const usuario = userEvent.setup();
    render();

    await preencherEAnexar(usuario);

    expect(screen.getByRole("button", { name: "Enviando..." })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    concluir({ ok: false, error: { code: "X", message: "falhou" } });
  });
});

describe("mensagem de sucesso", () => {
  it("some quando começa um novo preenchimento", async () => {
    anexarMock.mockResolvedValue({
      ok: true,
      data: { competencia: "202610", contaNegociacao: "123456", estado: "a_confirmar" },
    });
    const usuario = userEvent.setup();
    render();
    await preencherEAnexar(usuario);
    expect(await screen.findByText(/guia anexada/i)).toBeInTheDocument();

    await usuario.type(screen.getByLabelText(/conta de negociação/i), "9");

    expect(screen.queryByText(/guia anexada/i)).not.toBeInTheDocument();
  });
});

describe("avisos de erro ao corrigir", () => {
  it("o erro do campo e a recusa do servidor somem quando a pessoa corrige", async () => {
    // Sem nenhuma guia anexada o formulário de anexo fica à vista (com guia do mês, recolhido).
    listarMock.mockResolvedValue({ ok: true, data: [] });
    anexarMock.mockResolvedValue({
      ok: false,
      error: { code: "X", message: "Já existe guia anexada para esta competência." },
    });
    const usuario = userEvent.setup();
    render();
    const regiao = within(await regiaoDaGuia());

    const conta = regiao.getByLabelText(/conta de negociação/i);
    // maxLength do campo barra a digitação; o schema ainda guarda o limite.
    fireEvent.change(conta, { target: { value: "9".repeat(41) } });
    await usuario.click(regiao.getByRole("button", { name: "Anexar guia" }));
    expect(regiao.getByText("Conta de negociação: no máximo 40 caracteres.")).toBeInTheDocument();
    fireEvent.change(conta, { target: { value: "123" } });
    expect(
      regiao.queryByText("Conta de negociação: no máximo 40 caracteres."),
    ).not.toBeInTheDocument();
    // Os outros campos seguem acusando o que falta.
    expect(regiao.getByText("Anexe o PDF da guia.")).toBeInTheDocument();

    await usuario.upload(regiao.getByLabelText(/pdf da guia/i), pdf);
    await usuario.click(regiao.getByRole("button", { name: "Anexar guia" }));
    expect(await screen.findByText(/já existe guia anexada/i)).toBeInTheDocument();
    await usuario.type(regiao.getByLabelText(/conta de negociação/i), "2");
    expect(screen.queryByText(/já existe guia anexada/i)).not.toBeInTheDocument();
  });

  it("confirmar não trava os campos do formulário de anexar", async () => {
    listarMock.mockResolvedValue({
      ok: true,
      data: [{ competencia: "202610", contaNegociacao: "123456", estado: "a_confirmar" }],
    });
    confirmarMock.mockReturnValue(new Promise(() => undefined));
    const usuario = userEvent.setup();
    render();

    await liberarGuia(usuario);

    expect(screen.getByLabelText(/conta de negociação/i)).toBeEnabled();
    expect(screen.getByLabelText(/competência/i)).toBeEnabled();
  });
});

describe("falha ao carregar a lista de guias", () => {
  it("oferece Tentar novamente e recarrega a lista", async () => {
    listarMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "X", message: "falhou" },
    });
    const usuario = userEvent.setup();
    render();
    expect(await screen.findByText("Não foi possível carregar as guias anexadas.")).toBeVisible();
    listarMock.mockResolvedValue({
      ok: true,
      data: [{ competencia: "202610", contaNegociacao: "123456", estado: "confirmada" }],
    });

    await usuario.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText(/10\/2026 · conta 123456/)).toBeInTheDocument();
    expect(
      screen.queryByText("Não foi possível carregar as guias anexadas."),
    ).not.toBeInTheDocument();
  });
});

describe("trocar, remover e visualizar a guia anexada (#184)", () => {
  const naoEnviada: GuiaDaParcela = {
    competencia: "202610",
    contaNegociacao: "123456",
    estado: "confirmada",
  };

  beforeEach(() => {
    trocarMock.mockReset();
    removerMock.mockReset();
    obterLinkMock.mockReset();
    listarMock.mockReset();
    listarMock.mockResolvedValue({ ok: true, data: [naoEnviada] });
  });

  it("guia não enviada oferece Ver, Trocar e Remover; a enviada só Ver", async () => {
    listarMock.mockResolvedValue({
      ok: true,
      data: [naoEnviada, { ...naoEnviada, competencia: "202609", enviada: true }],
    });
    render();
    const regiao = within(await regiaoDaGuia());

    expect(await regiao.findByRole("button", { name: "Ver guia de 10/2026" })).toBeInTheDocument();
    expect(regiao.getByLabelText(/^Trocar guia de 10\/2026/)).toBeInTheDocument();
    expect(regiao.getByRole("button", { name: "Remover guia de 10/2026" })).toBeInTheDocument();
    expect(regiao.getByRole("button", { name: "Ver guia de 09/2026" })).toBeInTheDocument();
    expect(regiao.queryByLabelText(/^Trocar guia de 09\/2026/)).not.toBeInTheDocument();
    expect(
      regiao.queryByRole("button", { name: "Remover guia de 09/2026" }),
    ).not.toBeInTheDocument();
    expect(regiao.getByText("Enviada")).toBeInTheDocument();
  });

  it("troca: manda o PDF novo da competência e avisa que a guia foi trocada e confirmada", async () => {
    trocarMock.mockResolvedValue({ ok: true, data: naoEnviada });
    const usuario = userEvent.setup();
    render();
    const regiao = within(await regiaoDaGuia());

    await usuario.upload(await regiao.findByLabelText(/^Trocar guia de 10\/2026/), pdf);

    expect(trocarMock).toHaveBeenCalledWith({
      parcelamentoId: PARCELAMENTO_PGFN,
      competencia: "202610",
      arquivo: pdf,
    });
    expect(await regiao.findByText(/guia trocada e confirmada/i)).toBeInTheDocument();
  });

  it("troca que volta a guia a confirmar avisa com o motivo", async () => {
    trocarMock.mockResolvedValue({
      ok: true,
      data: { ...naoEnviada, estado: "a_confirmar", motivo: "A conta do PDF é diferente." },
    });
    const usuario = userEvent.setup();
    render();
    const regiao = within(await regiaoDaGuia());

    await usuario.upload(await regiao.findByLabelText(/^Trocar guia de 10\/2026/), pdf);

    expect(await regiao.findByText(/guia trocada, mas ainda não liberada/i)).toBeInTheDocument();
  });

  it("troca recusada pelo servidor (outra competência) mostra o motivo", async () => {
    trocarMock.mockResolvedValue({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "O PDF é de outra competência." },
    });
    const usuario = userEvent.setup();
    render();
    const regiao = within(await regiaoDaGuia());

    await usuario.upload(await regiao.findByLabelText(/^Trocar guia de 10\/2026/), pdf);

    expect(await regiao.findByText("O PDF é de outra competência.")).toBeInTheDocument();
  });

  it("arquivo que não é PDF nem chega ao servidor", async () => {
    const usuario = userEvent.setup({ applyAccept: false });
    render();
    const regiao = within(await regiaoDaGuia());
    const texto = new File(["x"], "guia.txt", { type: "text/plain" });

    await usuario.upload(await regiao.findByLabelText(/^Trocar guia de 10\/2026/), texto);

    expect(trocarMock).not.toHaveBeenCalled();
    expect(await regiao.findByText("Envie um arquivo PDF.")).toBeInTheDocument();
  });

  it("remove: chama a action e a guia some da lista", async () => {
    removerMock.mockResolvedValue({ ok: true, data: undefined });
    const usuario = userEvent.setup();
    render();
    const regiao = within(await regiaoDaGuia());
    const botao = await regiao.findByRole("button", { name: "Remover guia de 10/2026" });
    listarMock.mockResolvedValue({ ok: true, data: [] });

    await usuario.click(botao);
    // Um clique só não apaga: pede confirmação na própria linha.
    expect(removerMock).not.toHaveBeenCalled();
    await usuario.click(
      regiao.getByRole("button", { name: "Confirmar remoção da guia de 10/2026" }),
    );

    expect(removerMock).toHaveBeenCalledWith({
      parcelamentoId: PARCELAMENTO_PGFN,
      competencia: "202610",
    });
    expect(await regiao.findByText("Nenhuma guia anexada.")).toBeInTheDocument();
    expect(regiao.getByText("Guia removida.")).toBeInTheDocument();
  });

  it("o PDF vem primeiro; mês e conta ficam recolhidos e abrem sozinhos quando há valor", async () => {
    listarMock.mockResolvedValue({ ok: true, data: [] });
    const usuario = userEvent.setup();
    render();
    const regiao = within(await regiaoDaGuia());
    const detalhes = regiao.getByText("Preencher mês e conta à mão").closest("details");

    expect(detalhes).not.toHaveAttribute("open");
    const pdf = regiao.getByLabelText(/pdf da guia/i);
    const competencia = regiao.getByLabelText(/competência/i);
    expect(
      pdf.compareDocumentPosition(competencia) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await usuario.type(competencia, "2026-10");
    expect(detalhes).toHaveAttribute("open");
  });

  it("o resultado de uma ação sobre a guia aparece junto da lista, antes do formulário de anexo", async () => {
    removerMock.mockResolvedValue({ ok: true, data: undefined });
    const usuario = userEvent.setup();
    render();
    const regiao = within(await regiaoDaGuia());
    await usuario.click(await regiao.findByRole("button", { name: "Remover guia de 10/2026" }));
    listarMock.mockResolvedValue({ ok: true, data: [] });
    await usuario.click(
      regiao.getByRole("button", { name: "Confirmar remoção da guia de 10/2026" }),
    );

    const aviso = await regiao.findByText("Guia removida.");
    const campoDoPdf = regiao.getByLabelText(/pdf da guia/i);
    expect(
      aviso.compareDocumentPosition(campoDoPdf) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("cancelar a remoção não chama a action e devolve o foco ao botão Remover", async () => {
    const usuario = userEvent.setup();
    render();
    const regiao = within(await regiaoDaGuia());

    await usuario.click(await regiao.findByRole("button", { name: "Remover guia de 10/2026" }));
    expect(
      regiao.getByRole("button", { name: "Cancelar remoção da guia de 10/2026" }),
    ).toHaveFocus();
    await usuario.click(
      regiao.getByRole("button", { name: "Cancelar remoção da guia de 10/2026" }),
    );

    expect(removerMock).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(regiao.getByRole("button", { name: "Remover guia de 10/2026" })).toHaveFocus(),
    );
  });

  it("o campo de trocar segue focável enquanto outra ação está em curso", async () => {
    let concluir: (valor: unknown) => void = () => undefined;
    trocarMock.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
    const usuario = userEvent.setup();
    render();
    const regiao = within(await regiaoDaGuia());
    const campo = await regiao.findByLabelText(/^Trocar guia de 10\/2026/);
    campo.focus();

    await usuario.upload(campo, pdf);

    expect(campo).toBeEnabled();
    expect(campo).toHaveAttribute("aria-disabled", "true");
    expect(campo).toHaveFocus();
    concluir({ ok: true, data: naoEnviada });
  });

  it("escolher um arquivo para trocar durante outra ação avisa para aguardar, sem chamar a action", async () => {
    let concluir: (valor: unknown) => void = () => undefined;
    listarMock.mockResolvedValue({
      ok: true,
      data: [{ competencia: "202610", contaNegociacao: "123456", estado: "a_confirmar" }],
    });
    confirmarMock.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
    const usuario = userEvent.setup();
    render();
    const regiao = within(await regiaoDaGuia());
    await liberarGuia(usuario);

    await usuario.upload(regiao.getByLabelText(/^Trocar guia de 10\/2026/), pdf);

    expect(trocarMock).not.toHaveBeenCalled();
    // Não é erro: é espera, anunciada como status (com a mesma apresentação de "atenção").
    const aviso = await regiao.findByRole("status");
    expect(aviso).toHaveTextContent(/aguarde a ação em andamento/i);
    expect(regiao.queryByRole("alert", { name: /aguarde/i })).not.toBeInTheDocument();
    concluir({ ok: true, data: undefined });
  });

  it("remoção recusada (guia já enviada) mostra o motivo e mantém a guia", async () => {
    removerMock.mockResolvedValue({
      ok: false,
      error: { code: "PERSISTENCIA_ERROR", message: "Competência já enviada." },
    });
    const usuario = userEvent.setup();
    render();
    const regiao = within(await regiaoDaGuia());

    await usuario.click(await regiao.findByRole("button", { name: "Remover guia de 10/2026" }));
    await usuario.click(
      regiao.getByRole("button", { name: "Confirmar remoção da guia de 10/2026" }),
    );

    expect(await regiao.findByText("Competência já enviada.")).toBeInTheDocument();
    expect(regiao.getByText(/10\/2026 · conta 123456/)).toBeInTheDocument();
  });

  it("ver: abre o link temporário numa aba nova", async () => {
    obterLinkMock.mockResolvedValue({ ok: true, data: { url: "https://storage.exemplo/guia" } });
    // A aba abre no clique (senão o bloqueador de pop-up barra) e recebe o link quando ele chega.
    const aba = { location: { href: "" }, close: jest.fn(), opener: {} };
    const abrir = jest.spyOn(window, "open").mockReturnValue(aba as unknown as Window);
    const usuario = userEvent.setup();
    render();
    const regiao = within(await regiaoDaGuia());

    await usuario.click(await regiao.findByRole("button", { name: "Ver guia de 10/2026" }));

    expect(obterLinkMock).toHaveBeenCalledWith({
      parcelamentoId: PARCELAMENTO_PGFN,
      competencia: "202610",
    });
    expect(abrir).toHaveBeenCalledWith("about:blank", "_blank");
    expect(aba.location.href).toBe("https://storage.exemplo/guia");
    expect(aba.opener).toBeNull();
    abrir.mockRestore();
  });

  it("ver sem permissão mostra o erro e não abre aba", async () => {
    obterLinkMock.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "Guia não encontrada." },
    });
    const aba = { location: { href: "" }, close: jest.fn(), opener: {} };
    const abrir = jest.spyOn(window, "open").mockReturnValue(aba as unknown as Window);
    const usuario = userEvent.setup();
    render();
    const regiao = within(await regiaoDaGuia());

    await usuario.click(await regiao.findByRole("button", { name: "Ver guia de 10/2026" }));

    expect(await regiao.findByText("Guia não encontrada.")).toBeInTheDocument();
    expect(aba.close).toHaveBeenCalled();
    expect(aba.location.href).toBe("");
    abrir.mockRestore();
  });
});

describe("Parcelamento PGFN cadastrado só ganha guias (#184)", () => {
  it("código, parcelas restantes e É interno ficam desabilitados no PGFN; o da Receita segue editável", async () => {
    listarMock.mockReset();
    listarMock.mockResolvedValue({ ok: true, data: [] });
    render();
    await regiaoDaGuia();

    const grupos = screen.getAllByRole("group", { name: /^Parcelamento \d$/ });
    const [pgfn, receita] = grupos.map((grupo) => within(grupo));
    expect(pgfn.getByLabelText("Código")).toBeDisabled();
    expect(pgfn.getByLabelText(/parcelas restantes/i)).toBeDisabled();
    expect(pgfn.getByLabelText("É interno")).toBeDisabled();
    expect(receita.getByLabelText("Código")).toBeEnabled();
    expect(receita.getByLabelText(/parcelas restantes/i)).toBeEnabled();
  });
});
