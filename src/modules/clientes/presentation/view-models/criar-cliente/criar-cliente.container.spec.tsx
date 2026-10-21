import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok } from "@/shared/kernel/result";

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

// Regex: os labels obrigatórios ganharam um "*" visual, então o texto exato não bate.
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

  it("autopreenche Empresa e Regime ao sair do CNPJ", async () => {
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

  it("mostra 'CNPJ inválido' no blur quando o dígito verificador não bate, sem consultar a API (achado real, 2026-09-29)", async () => {
    const usuario = userEvent.setup();
    render(<CriarClienteContainer />);

    await usuario.type(screen.getByLabelText(/^CNPJ/), "01.010.101/0101-01");
    await usuario.tab();

    expect(await screen.findByText("CNPJ inválido")).toBeInTheDocument();
    expect(consultarMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/CNPJ não encontrado/)).not.toBeInTheDocument();
  });

  it("mapeia erro de campo devolvido pelo servidor pro input certo (não fica só um aviso genérico)", async () => {
    executeMock.mockResolvedValue(
      err(new ValidationError("Dados de cliente inválidos", { cnpj: ["CNPJ já cadastrado"] })),
    );
    const usuario = userEvent.setup();
    render(<CriarClienteContainer />);

    await preencherCamposObrigatorios(usuario);
    await usuario.click(screen.getByRole("button", { name: "Cadastrar" }));

    expect(await screen.findByText("CNPJ já cadastrado")).toBeInTheDocument();
  });

  it("preserva as letras do CNPJ alfanumérico ao digitar e consulta com a forma canônica", async () => {
    const usuario = userEvent.setup();
    render(<CriarClienteContainer />);

    await usuario.type(screen.getByLabelText(/^CNPJ/), "00000000e08g12");
    await usuario.tab();

    expect(screen.getByLabelText(/^CNPJ/)).toHaveValue("00.000.000/E08G-12");
    expect(consultarMock).toHaveBeenCalledWith("00000000E08G12");
    expect(screen.queryByText("CNPJ inválido")).not.toBeInTheDocument();
  });

  it("não aplica Empresa/Regime de uma resposta que chega depois de o CNPJ ter mudado", async () => {
    let responderA: (dados: unknown) => void = () => undefined;
    consultarMock
      .mockImplementationOnce(() => new Promise((resolver) => (responderA = resolver)))
      .mockResolvedValueOnce({}); // B não traz Empresa nem Regime: ficam vazios
    const usuario = userEvent.setup();
    render(<CriarClienteContainer />);
    const campo = screen.getByLabelText(/^CNPJ/);

    await usuario.type(campo, "11.444.777/0001-61");
    await usuario.tab(); // consulta A fica pendente
    await usuario.clear(campo);
    await usuario.type(campo, "00.000.000/E08G-12");
    await usuario.tab(); // consulta B responde antes
    expect(await screen.findByText(/Não foi possível confirmar o Regime/)).toBeInTheDocument();

    await act(async () => responderA({ empresa: "Empresa A", regime: "simples_nacional" }));
    await new Promise((resolver) => setTimeout(resolver, 10)); // folga pro setTimeout(0) interno

    expect(screen.getByLabelText(/^Empresa/)).toHaveValue("");
    expect(screen.getByLabelText(/^Regime/)).toHaveValue("");
  });

  it("descarta a resposta do CNPJ que chega depois de 'Cadastrar outro' sem lançar exceção", async () => {
    let responderA: (dados: unknown) => void = () => undefined;
    consultarMock.mockImplementationOnce(() => new Promise((resolver) => (responderA = resolver)));
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
    const rejeicoes: unknown[] = [];
    const aoRejeitar = (motivo: unknown) => rejeicoes.push(motivo);
    process.on("unhandledRejection", aoRejeitar);
    const usuario = userEvent.setup();
    render(<CriarClienteContainer />);

    await preencherCamposObrigatorios(usuario); // blur do CNPJ deixa a consulta A pendente
    await usuario.click(screen.getByRole("button", { name: "Cadastrar" }));
    await screen.findByText(/cadastrado/);
    await usuario.click(screen.getByRole("button", { name: "Cadastrar outro" }));

    await act(async () => responderA({ empresa: "Empresa A", regime: "simples_nacional" }));
    await new Promise((resolver) => setTimeout(resolver, 10)); // folga pro setTimeout(0) interno
    process.off("unhandledRejection", aoRejeitar);

    expect(rejeicoes).toEqual([]);
    expect(screen.getByLabelText(/^Empresa/)).toHaveValue("");
    expect(screen.getByLabelText(/^Regime/)).toHaveValue("");
  });

  it("Promise rejeitada da Server Action não prende o botão em 'Cadastrando...'", async () => {
    executeMock.mockRejectedValue(new Error("falha de rede"));
    const usuario = userEvent.setup();
    render(<CriarClienteContainer />);

    await preencherCamposObrigatorios(usuario);
    await usuario.click(screen.getByRole("button", { name: "Cadastrar" }));

    expect(await screen.findByText(/Não foi possível cadastrar agora/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cadastrar" })).toBeEnabled();
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
          alteracoesContratuais: [
            { numero: 1, data: "2026-02-01", arquivoCaminho: "1/alteracoes/1-doc.pdf" },
          ],
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
        alteracoesContratuais: [expect.objectContaining({ numero: 1, data: "2026-02-01" })],
      }),
    );
  });

  describe("nº da alteração", () => {
    const escolherArquivo = async (
      usuario: ReturnType<typeof userEvent.setup>,
      indice: number,
      nome: string,
    ) => {
      await usuario.click(screen.getByRole("button", { name: "Adicionar" }));
      await usuario.upload(screen.getByLabelText(`Arquivo da alteração ${indice}`), arquivo(nome));
    };

    it("pré-preenche pelo prefixo do arquivo e, sem prefixo, com o maior nº + 1", async () => {
      const usuario = userEvent.setup();
      render(<CriarClienteContainer />);

      await escolherArquivo(usuario, 1, "3-alteracao.pdf");
      await escolherArquivo(usuario, 2, "alteracao.pdf");

      expect(screen.getByLabelText("Nº da alteração 1")).toHaveValue(3);
      expect(screen.getByLabelText("Nº da alteração 2")).toHaveValue(4);
    });

    it("não sobrescreve o nº que o Admin digitou", async () => {
      const usuario = userEvent.setup();
      render(<CriarClienteContainer />);

      await usuario.click(screen.getByRole("button", { name: "Adicionar" }));
      await usuario.type(screen.getByLabelText("Nº da alteração 1"), "7");
      await usuario.upload(screen.getByLabelText("Arquivo da alteração 1"), arquivo("2-alt.pdf"));

      expect(screen.getByLabelText("Nº da alteração 1")).toHaveValue(7);
    });

    it("barra nº repetido no formulário, sem chamar o servidor", async () => {
      const usuario = userEvent.setup();
      render(<CriarClienteContainer />);

      await preencherCamposObrigatorios(usuario);
      await escolherArquivo(usuario, 1, "1-a.pdf");
      await escolherArquivo(usuario, 2, "1-b.pdf");
      fireEvent.change(screen.getByLabelText("Data da alteração 1"), {
        target: { value: "2026-02-01" },
      });
      fireEvent.change(screen.getByLabelText("Data da alteração 2"), {
        target: { value: "2026-03-01" },
      });
      await usuario.click(screen.getByRole("button", { name: "Cadastrar" }));

      expect(await screen.findAllByText("Já existe a alteração nº 1")).toHaveLength(2);
      expect(executeMock).not.toHaveBeenCalled();
    });
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
