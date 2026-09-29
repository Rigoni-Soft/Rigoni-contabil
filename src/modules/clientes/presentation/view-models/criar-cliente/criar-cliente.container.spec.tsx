import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ok } from "@/shared/kernel/result";

import { CriarClienteContainer } from "./criar-cliente.container";

const executeMock = jest.fn();
const consultarMock = jest.fn();

jest.mock("@/main/clientes.factory", () => ({
  makeCriarCliente: () => ({ execute: executeMock }),
}));

jest.mock("./use-consultar-cnpj.hook", () => ({
  useConsultarCnpj: () => ({ consultar: consultarMock }),
}));

function arquivo(nome: string): File {
  return new File(["conteúdo"], nome, { type: "application/pdf" });
}

// Regex: os labels obrigatórios ganharam um "*" visual (ponto 6 do feedback
// manual, 2026-09-29), então o texto exato não bate mais.
async function preencherCamposObrigatorios(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.type(screen.getByLabelText(/^CNPJ/), "11.444.777/0001-61");
  await usuario.type(screen.getByLabelText(/^Empresa/), "Padaria Pão Quente Ltda");
  await usuario.selectOptions(screen.getByLabelText(/^Regime/), "simples_nacional");
  await usuario.upload(screen.getByLabelText("Contrato social"), arquivo("contrato-social.pdf"));
}

describe("CriarClienteContainer", () => {
  beforeEach(() => {
    executeMock.mockReset();
    consultarMock.mockReset();
    consultarMock.mockResolvedValue(null);
  });

  it("autopreenche Empresa e Regime ao sair do CNPJ (ponto 4 do feedback manual, 2026-09-29)", async () => {
    consultarMock.mockResolvedValue({
      empresa: "Padaria Pão Quente Ltda",
      regime: "simples_nacional",
    });
    const usuario = userEvent.setup();
    render(<CriarClienteContainer />);

    await usuario.type(screen.getByLabelText(/^CNPJ/), "11.444.777/0001-61");
    await usuario.tab();

    expect(await screen.findByLabelText(/^Empresa/)).toHaveValue("Padaria Pão Quente Ltda");
    expect(screen.getByLabelText(/^Regime/)).toHaveValue("simples_nacional");
    expect(consultarMock).toHaveBeenCalledWith("11444777000161");
  });

  it("não sobrescreve Empresa já preenchida à mão pelo autopreenchimento", async () => {
    consultarMock.mockResolvedValue({
      empresa: "Nome da API",
      regime: "simples_nacional",
    });
    const usuario = userEvent.setup();
    render(<CriarClienteContainer />);

    await usuario.type(screen.getByLabelText(/^Empresa/), "Nome digitado à mão");
    await usuario.type(screen.getByLabelText(/^CNPJ/), "11.444.777/0001-61");
    await usuario.tab();

    await screen.findByLabelText(/^Regime/);
    expect(screen.getByLabelText(/^Empresa/)).toHaveValue("Nome digitado à mão");
  });

  it("avisa e libera Empresa/Regime pra preenchimento manual quando o CNPJ não é encontrado", async () => {
    consultarMock.mockResolvedValue(null);
    const usuario = userEvent.setup();
    render(<CriarClienteContainer />);

    await usuario.type(screen.getByLabelText(/^CNPJ/), "11.444.777/0001-61");
    await usuario.tab();

    expect(
      await screen.findByText(/CNPJ não encontrado.*preencha Empresa e Regime manualmente/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Empresa/)).not.toBeDisabled();
    expect(screen.getByLabelText(/^Regime/)).not.toBeDisabled();

    // segue preenchível à mão depois do aviso
    await usuario.type(screen.getByLabelText(/^Empresa/), "Padaria Pão Quente Ltda");
    expect(screen.getByLabelText(/^Empresa/)).toHaveValue("Padaria Pão Quente Ltda");
  });

  it("avisa e libera Regime pra seleção manual quando o CNPJ é encontrado mas o regime não é confirmado", async () => {
    consultarMock.mockResolvedValue({ empresa: "Padaria Pão Quente Ltda", regime: undefined });
    const usuario = userEvent.setup();
    render(<CriarClienteContainer />);

    await usuario.type(screen.getByLabelText(/^CNPJ/), "11.444.777/0001-61");
    await usuario.tab();

    expect(await screen.findByLabelText(/^Empresa/)).toHaveValue("Padaria Pão Quente Ltda");
    expect(screen.getByText(/Não foi possível confirmar o Regime/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Regime/)).not.toBeDisabled();
    expect(screen.getByLabelText(/^Regime/)).toHaveValue("");
  });

  it("some o aviso de Regime assim que o usuário seleciona manualmente", async () => {
    consultarMock.mockResolvedValue({ empresa: "Padaria Pão Quente Ltda", regime: undefined });
    const usuario = userEvent.setup();
    render(<CriarClienteContainer />);

    await usuario.type(screen.getByLabelText(/^CNPJ/), "11.444.777/0001-61");
    await usuario.tab();
    await screen.findByText(/Não foi possível confirmar o Regime/i);

    await usuario.selectOptions(screen.getByLabelText(/^Regime/), "simples_nacional");

    expect(screen.queryByText(/Não foi possível confirmar o Regime/i)).not.toBeInTheDocument();
  });

  it("aplica a máscara de CNPJ enquanto digita", async () => {
    const usuario = userEvent.setup();
    render(<CriarClienteContainer />);

    await usuario.type(screen.getByLabelText(/^CNPJ/), "11444777000161");

    expect(screen.getByLabelText(/^CNPJ/)).toHaveValue("11.444.777/0001-61");
  });

  it("submete o formulário preenchido, sem alteração contratual, e mostra a confirmação", async () => {
    executeMock.mockResolvedValue(
      ok({
        cliente: {
          id: "1",
          empresa: "Padaria Pão Quente Ltda",
          cnpj: "11444777000161",
          regime: "simples_nacional",
          contratoSocialCaminho: "1/contrato-social/doc.pdf",
          alteracoesContratuais: [],
        },
      }),
    );
    const usuario = userEvent.setup();
    render(<CriarClienteContainer />);

    await preencherCamposObrigatorios(usuario);
    await usuario.click(screen.getByRole("button", { name: "Cadastrar" }));

    expect(await screen.findByText(/cadastrado/)).toBeInTheDocument();
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it("adiciona e remove uma linha de alteração contratual", async () => {
    const usuario = userEvent.setup();
    render(<CriarClienteContainer />);

    await usuario.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(screen.getByText("Alteração 1")).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: "Remover alteração 1" }));
    expect(screen.queryByText("Alteração 1")).not.toBeInTheDocument();
  });

  it("submete com uma alteração contratual preenchida (data + arquivo)", async () => {
    executeMock.mockResolvedValue(
      ok({
        cliente: {
          id: "1",
          empresa: "Padaria Pão Quente Ltda",
          cnpj: "11444777000161",
          regime: "simples_nacional",
          contratoSocialCaminho: "1/contrato-social/doc.pdf",
          alteracoesContratuais: [{ data: "2026-02-01", arquivoCaminho: "1/alteracoes/0-doc.pdf" }],
        },
      }),
    );
    const usuario = userEvent.setup();
    render(<CriarClienteContainer />);

    await preencherCamposObrigatorios(usuario);
    await usuario.click(screen.getByRole("button", { name: "Adicionar" }));
    // input type=date: userEvent.type digita por segmento (ano/mês/dia) e é
    // instável em jsdom — fireEvent.change atribui o valor ISO direto.
    fireEvent.change(screen.getByLabelText("Data da alteração 1"), {
      target: { value: "2026-02-01" },
    });
    await usuario.upload(
      screen.getByLabelText("Arquivo da alteração 1"),
      arquivo("alteracao-1.pdf"),
    );
    await usuario.click(screen.getByRole("button", { name: "Cadastrar" }));

    expect(await screen.findByText(/cadastrado/)).toBeInTheDocument();
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        alteracoesContratuais: [expect.objectContaining({ data: "2026-02-01" })],
      }),
    );
  });

  it("'Cadastrar outro' volta pro formulário limpo", async () => {
    executeMock.mockResolvedValue(
      ok({
        cliente: {
          id: "1",
          empresa: "Padaria Pão Quente Ltda",
          cnpj: "11444777000161",
          regime: "simples_nacional",
          contratoSocialCaminho: "1/contrato-social/doc.pdf",
          alteracoesContratuais: [],
        },
      }),
    );
    const usuario = userEvent.setup();
    render(<CriarClienteContainer />);

    await preencherCamposObrigatorios(usuario);
    await usuario.click(screen.getByRole("button", { name: "Cadastrar" }));
    await screen.findByText(/cadastrado/);

    await usuario.click(screen.getByRole("button", { name: "Cadastrar outro" }));

    expect(screen.queryByText(/cadastrado/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Empresa/)).toHaveValue("");
  });
});
