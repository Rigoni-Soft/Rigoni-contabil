import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CadastroOperacionalClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";

import { EditarCadastroOperacionalContainer } from "./editar-cadastro-operacional.container";

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
  });

  it("modo readOnly: nunca renderiza contrato social/alterações e não mostra botão Salvar", () => {
    render(<EditarCadastroOperacionalContainer dados={dados} readOnly />);

    expect(screen.queryByText(/contrato social/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/alteraç(ão|ões) contratua/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /salvar/i })).not.toBeInTheDocument();
  });

  it("modo edição: campos ficam habilitados e o botão Salvar aparece", () => {
    render(<EditarCadastroOperacionalContainer dados={dados} readOnly={false} />);

    expect(screen.getByLabelText(/forma de envio/i)).toBeEnabled();
    expect(screen.getByRole("button", { name: /salvar/i })).toBeInTheDocument();
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

  it("cliente não encontrado: mostra mensagem em vez do formulário", () => {
    render(<EditarCadastroOperacionalContainer dados={null} readOnly={false} />);

    expect(screen.getByText(/cliente não encontrado/i)).toBeInTheDocument();
  });
});
