import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render as renderRtl, screen, within } from "@testing-library/react";
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
jest.mock("./anexar-guia-parcela-pgfn.actions", () => ({
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

const regiaoDaGuia = () => screen.findByRole("group", { name: "Guias da parcela" });

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
    expect(screen.getAllByRole("group", { name: "Guias da parcela" })).toHaveLength(1);
    expect(listarMock).toHaveBeenCalledWith({ parcelamentoId: PARCELAMENTO_PGFN });
  });

  it("visualização (somente leitura) não mostra o campo de anexar", () => {
    render(true);

    expect(screen.queryByRole("group", { name: "Guias da parcela" })).not.toBeInTheDocument();
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
      screen.getByRole("button", { name: "Confirmar guia de 10/2026" }),
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
    const botao = await screen.findByRole("button", { name: "Confirmar guia de 10/2026" });
    listarMock.mockResolvedValue({
      ok: true,
      data: [{ competencia: "202610", contaNegociacao: "123456", estado: "confirmada" }],
    });

    await usuario.click(botao);

    expect(confirmarMock).toHaveBeenCalledWith({
      parcelamentoId: PARCELAMENTO_PGFN,
      competencia: "202610",
    });
    expect(await screen.findByText("Confirmada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirmar guia/i })).not.toBeInTheDocument();
    // O botão sumiu: o foco vai ao item da guia, não cai no topo da página.
    expect(screen.getByText(/10\/2026 · conta 123456/).closest("li")).toHaveFocus();
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

    expect(
      await screen.findByText(/ainda não liberada ao envio. Conferir a conta./),
    ).toBeInTheDocument();
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
    const confirmar = await screen.findByRole("button", { name: "Confirmar guia de 10/2026" });

    await usuario.click(confirmar);

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

    await usuario.click(await screen.findByRole("button", { name: "Confirmar guia de 10/2026" }));

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
