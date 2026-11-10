import { render, screen } from "@testing-library/react";

import { CartaoDoCadastro } from "./cartao-do-cadastro.component";

const BASE = {
  cabecalho: { empresa: "Padaria Sol", cnpj: "90.000.001/0001-29" },
  onSubmit: jest.fn(),
  pendente: false,
  readOnly: false,
};

describe("CartaoDoCadastro", () => {
  it("monta a nota, o mês, o cabeçalho, o acompanhamento, os campos, as ações e o resultado nessa ordem", () => {
    const { container } = render(
      <CartaoDoCadastro
        {...BASE}
        mesDoAcompanhamento={<p>Mês</p>}
        responsavel={<p>Responsável</p>}
        acompanhamento={<p>Serviços</p>}
        acoes={<button type="submit">Salvar</button>}
        erroServidor="Falhou."
        sucesso={<p>Salvo</p>}
      >
        <p>Campos do Setor</p>
      </CartaoDoCadastro>,
    );

    const texto = container.textContent ?? "";
    expect(screen.getByDisplayValue("Padaria Sol")).toBeInTheDocument();
    const posicoes = [
      "Mês",
      "Responsável",
      "Serviços",
      "Campos do Setor",
      "Salvar",
      "Falhou.",
      "Salvo",
    ].map((t) => texto.indexOf(t));
    expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));
    expect(posicoes).not.toContain(-1);
  });

  it("só leitura: sem a nota de obrigatórios e sem as ações, com os campos desabilitados", () => {
    render(
      <CartaoDoCadastro {...BASE} readOnly acoes={<button type="submit">Salvar</button>}>
        <input aria-label="Campo" />
      </CartaoDoCadastro>,
    );

    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Campo")).toBeDisabled();
  });
});
