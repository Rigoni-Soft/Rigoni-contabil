import { render, screen } from "@testing-library/react";

import { CabecalhoDeTela } from "./cabecalho-de-tela.component";
import { CampoDeArquivo } from "./campo-de-arquivo.component";
import { CartaoDeResumo } from "./cartao-de-resumo.component";
import { LinhaDeCliente } from "./linha-de-cliente.component";
import { LinhaDeRegistro } from "./linha-de-registro.component";
import { LinhaDeUsuario } from "./linha-de-usuario.component";

describe("moléculas de lista e de tela", () => {
  it("LinhaDeUsuario mostra o resumo e o aviso de bloqueio pendente", () => {
    render(
      <ul>
        <LinhaDeUsuario
          nome="Ana"
          resumo="ana@x.com · Funcionário · Simples Nacional"
          bloqueioPendente
          acoes={<button type="button">Desativar</button>}
        />
      </ul>,
    );

    expect(screen.getByText("ana@x.com · Funcionário · Simples Nacional")).toBeInTheDocument();
    expect(screen.getByText(/bloqueio da conta ainda não foi concluído/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desativar" })).toBeInTheDocument();
  });

  it("LinhaDeCliente é um link para o cadastro", () => {
    render(
      <ul>
        <LinhaDeCliente href="/clientes/1" empresa="Padaria" cnpj="11.444.777/0001-61" />
      </ul>,
    );

    expect(screen.getByRole("link")).toHaveAttribute("href", "/clientes/1");
    expect(screen.getByText("Padaria")).toBeInTheDocument();
  });

  it("LinhaDeRegistro mostra data, ator e o resultado com texto", () => {
    render(
      <table>
        <tbody>
          <LinhaDeRegistro
            registro={{
              id: "1",
              ator: "Ana",
              setor: "SN",
              acao: "criar",
              alvo: "cliente",
              resultado: "sucesso",
              dataHora: "08/10 12:30",
            }}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByRole("cell", { name: "08/10 12:30" })).toBeInTheDocument();
    expect(screen.getByText("sucesso")).toHaveClass("text-primary");
  });

  it("CartaoDeResumo leva à lista do status e dá o contexto à leitura", () => {
    render(
      <ul>
        <CartaoDeResumo
          href="/clientes/resumo/em_dia"
          titulo="Em dia"
          cor="em_dia"
          quantidade={4}
          totalClientes={10}
        />
      </ul>,
    );

    expect(screen.getByRole("link")).toHaveAttribute("href", "/clientes/resumo/em_dia");
    expect(screen.getByRole("link")).toHaveTextContent("Em dia — 4 de 10 clientes");
  });

  it("CampoDeArquivo liga o rótulo e mostra o erro", () => {
    render(
      <CampoDeArquivo
        id="contrato"
        rotulo="Contrato social"
        onChange={jest.fn()}
        erro="Arquivo inválido."
      />,
    );

    expect(screen.getByLabelText("Contrato social")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Arquivo inválido.");
    expect(screen.getByLabelText("Contrato social")).toHaveAccessibleDescription(
      "Arquivo inválido.",
    );
  });

  it("CabecalhoDeTela mostra Voltar, título e descrição; sem nada, não renderiza link nem h1", () => {
    const { rerender } = render(
      <CabecalhoDeTela voltarHref="/" titulo="Usuários" descricao="Quem acessa." />,
    );
    expect(screen.getByRole("link", { name: "Voltar" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("heading", { level: 1, name: "Usuários" })).toBeInTheDocument();
    expect(screen.getByText("Quem acessa.")).toBeInTheDocument();

    rerender(<CabecalhoDeTela />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
