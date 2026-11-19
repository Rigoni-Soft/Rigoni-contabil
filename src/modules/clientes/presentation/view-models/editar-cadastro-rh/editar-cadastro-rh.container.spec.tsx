import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as renderRtl, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CadastroRhClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok } from "@/shared/kernel/result";

import { cadastroRhDeTeste } from "../../../../../../test-support/cadastro-de-teste";
import { salvarParcelamentosAction } from "../editar-cadastro-operacional/salvar-parcelamentos.actions";
import { editarCadastroRhAction } from "./editar-cadastro-rh.actions";
import { EditarCadastroRhContainer } from "./editar-cadastro-rh.container";

jest.mock("./editar-cadastro-rh.actions", () => {
  const real = jest.requireActual("./editar-cadastro-rh.actions");
  return { ...real, editarCadastroRhAction: jest.fn(real.editarCadastroRhAction) };
});

jest.mock("../editar-cadastro-operacional/salvar-parcelamentos.actions", () => ({
  salvarParcelamentosAction: jest.fn(),
}));

const routerPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: jest.fn() }),
}));

const executeMock = jest.fn();
jest.mock("@/main/clientes.factory", () => ({
  makeEditarCadastroRhCliente: () => ({ execute: executeMock }),
  makeDefinirTiposDeEnvioDoContato: () => ({ execute: jest.fn() }),
  makeListarDocumentosContratuaisCliente: () => ({ execute: async () => ok([]) }),
  makeObterLinkDocumentoContratual: () => ({ execute: jest.fn() }),
}));

// O Admin só cadastra contatos (sem Setor, não define destinos): os testes de contatos e do resto do cadastro.
const ADMIN = { papel: "admin", setor: "administrativo" };

const dados: CadastroRhClienteDto = cadastroRhDeTeste({
  cnpj: "11.444.777/0001-61",
  contatos: [{ id: "c1", nome: "Maria", telefone: "11999990000", email: "" }],
  observacoes: "Folha no 5º dia útil.",
});

function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderRtl(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const montar = (props: Partial<React.ComponentProps<typeof EditarCadastroRhContainer>> = {}) =>
  render(
    <EditarCadastroRhContainer
      dados={dados}
      ator={ADMIN}
      readOnly={false}
      voltarHref="/rh"
      {...props}
    />,
  );

describe("EditarCadastroRhContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    executeMock.mockResolvedValue(ok({ clienteId: dados.id }));
  });

  it("mostra empresa, CNPJ, contatos e as observações do RH, sem Regime nem campos do SN", async () => {
    montar();

    expect(await screen.findByDisplayValue("Padaria Pão Quente Ltda")).toBeInTheDocument();
    expect(screen.getByLabelText("Observações gerais do RH")).toHaveValue("Folha no 5º dia útil.");
    expect(screen.getByDisplayValue("Maria")).toBeInTheDocument();
    expect(screen.queryByLabelText("Regime")).not.toBeInTheDocument();
    expect(screen.queryByText(/DAS/)).not.toBeInTheDocument();
  });

  it("salvar envia só as observações do RH e os contatos e volta para a lista de origem", async () => {
    montar();
    const usuario = userEvent.setup();

    const observacoes = await screen.findByLabelText("Observações gerais do RH");
    await usuario.clear(observacoes);
    await usuario.type(observacoes, "Pagar no dia 10.");
    await usuario.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/rh"));
    const enviado = jest.mocked(editarCadastroRhAction).mock.calls.at(-1)?.[0];
    expect(enviado).toEqual({
      clienteId: dados.id,
      observacoes: "Pagar no dia 10.",
      contatos: [{ id: "c1", nome: "Maria", telefone: "11999990000", email: "" }],
    });
  });

  it("edita as parcelas de um Parcelamento do RH e o salva com o Setor RH, só depois do cadastro", async () => {
    const parcelamento = {
      id: "7b1c9c6e-9d1a-4c9a-8b1e-2e2a4a5b6c7d",
      codigo: "RH-100",
      parcelasRestantes: 5,
      interno: false,
      arquivoNome: "acordo.pdf",
      acordo: {
        origem: null,
        totalDeParcelas: null,
        valorDaParcelaCentavos: null,
        dataDeAdesao: null,
      },
      quitado: false,
      temEnvio: false,
      enviadoNoMes: false,
    };
    jest
      .mocked(salvarParcelamentosAction)
      .mockResolvedValue({ ok: true, data: { ids: [parcelamento.id] } });
    montar({ dados: { ...dados, parcelamentos: [parcelamento] } });
    const usuario = userEvent.setup();

    expect(await screen.findByText(/Tem parcelamento:/)).toHaveTextContent("Sim (1)");
    const parcelas = await screen.findByDisplayValue("5");
    await usuario.clear(parcelas);
    await usuario.type(parcelas, "4");
    await usuario.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/rh"));
    expect(salvarParcelamentosAction).toHaveBeenCalledWith({
      clienteId: dados.id,
      setor: "rh",
      parcelamentos: [
        expect.objectContaining({ id: parcelamento.id, codigo: "RH-100", parcelasRestantes: 4 }),
      ],
    });
  });

  it("mostra a recusa do servidor e não navega", async () => {
    executeMock.mockResolvedValue(err(new ForbiddenError("Você não é o Responsável do RH.")));
    montar();

    await userEvent.setup().click(await screen.findByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Você não é o Responsável do RH.")).toBeInTheDocument();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("o erro de campo das observações aparece sob o textarea", async () => {
    executeMock.mockResolvedValue(
      err(new ValidationError("Dados inválidos.", { observacoes: ["Texto longo demais"] })),
    );
    montar();

    await userEvent.setup().click(await screen.findByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Texto longo demais")).toBeInTheDocument();
  });

  it.each([
    [new TypeError("fetch failed"), "Sem conexão com o servidor"],
    [new Error("boom"), "Erro inesperado no servidor"],
  ])("falha de transporte (%s) mostra a causa e não navega", async (falha, texto) => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.mocked(editarCadastroRhAction).mockRejectedValueOnce(falha);
    montar();

    await userEvent.setup().click(await screen.findByRole("button", { name: "Salvar" }));

    expect(await screen.findByText(new RegExp(texto))).toBeInTheDocument();
    expect(routerPush).not.toHaveBeenCalled();
  });

  describe("o que cada contato recebe do RH", () => {
    const FUNCIONARIO_RH = { papel: "funcionario", setor: "rh" };
    const dadosComEnvios: CadastroRhClienteDto = {
      ...dados,
      contatos: [
        { id: "c1", nome: "Maria", telefone: "11999990000", email: "", donoSetor: "rh" },
        {
          id: "c2",
          nome: "Paulo",
          telefone: "",
          email: "paulo@exemplo.com",
          donoSetor: "simples_nacional",
        },
      ],
      tiposDeEnvio: [
        { slug: "guia_parcelamento", rotulo: "Guia de parcelamento" },
        { slug: "avisos", rotulo: "Avisos" },
      ],
      destinos: [{ id: "d1", contatoId: "c1", tipo: "guia_parcelamento", canal: "whatsapp" }],
    };

    it("cada contato tem os checkboxes do catálogo do RH, com o que já recebe marcado", async () => {
      montar({ dados: dadosComEnvios, ator: FUNCIONARIO_RH });

      const maria = await screen.findByRole("group", { name: "Envios do contato 1" });
      expect(within(maria).getByLabelText("Guia de parcelamento")).toBeChecked();
      expect(within(maria).getByLabelText("Avisos")).not.toBeChecked();
      expect(within(maria).queryByLabelText("DAS")).toBeNull();
      expect(screen.getByRole("button", { name: "Adicionar contato" })).toBeInTheDocument();
    });

    it("contato de outro Setor aparece só em leitura", async () => {
      montar({ dados: dadosComEnvios, ator: FUNCIONARIO_RH });

      expect(await screen.findByText(/Contato do Simples Nacional/)).toBeInTheDocument();
      const nomes = screen.getAllByLabelText(/^Nome/, { selector: "input[id^='contatos.']" });
      expect(nomes[0]).not.toHaveAttribute("readonly");
      expect(nomes[1]).toHaveAttribute("readonly");
    });

    it("o Admin edita qualquer contato, sem checkboxes", async () => {
      montar({ dados: dadosComEnvios, ator: ADMIN });

      expect(await screen.findByRole("button", { name: "Adicionar contato" })).toBeInTheDocument();
      expect(screen.queryByRole("group", { name: /Envios do contato/ })).toBeNull();
      const nomes = screen.getAllByLabelText(/^Nome/, { selector: "input[id^='contatos.']" });
      expect(nomes[1]).not.toHaveAttribute("readonly");
    });
  });

  it("somente leitura não oferece Salvar", async () => {
    montar({ readOnly: true });

    expect(await screen.findByDisplayValue("Padaria Pão Quente Ltda")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument();
  });

  it("cliente inexistente avisa", () => {
    montar({ dados: null });

    expect(screen.getByText("Cliente não encontrado.")).toBeInTheDocument();
  });
});
