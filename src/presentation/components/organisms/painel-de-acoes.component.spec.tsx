import { render, screen } from "@testing-library/react";

import { PainelDeAcoes } from "./painel-de-acoes.component";

describe("PainelDeAcoes", () => {
  it("é um painel lateral com os serviços, a transferência e o encerramento", () => {
    render(
      <PainelDeAcoes
        servicos={<p>serviços aqui</p>}
        transferencia={<p>transferência aqui</p>}
        encerramento={<p>encerramento aqui</p>}
      />,
    );

    const painel = screen.getByRole("complementary", { name: "Ações do Atendimento" });
    expect(painel).toHaveTextContent("serviços aqui");
    expect(painel).toHaveTextContent("transferência aqui");
    expect(painel).toHaveTextContent("encerramento aqui");
  });

  it("depois de transferido troca as ações pelo aviso de para onde foi", () => {
    render(
      <PainelDeAcoes
        transferidoPara="Tributário"
        servicos={<p>serviços aqui</p>}
        transferencia={<p>transferência aqui</p>}
        encerramento={<p>encerramento aqui</p>}
      />,
    );

    expect(screen.getByText(/Foi para o Setor Tributário/)).toBeInTheDocument();
    expect(screen.queryByText("serviços aqui")).not.toBeInTheDocument();
    expect(screen.queryByText("transferência aqui")).not.toBeInTheDocument();
  });
});
