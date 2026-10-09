import { render, screen } from "@testing-library/react";

import { CabecalhoDaConversa } from "./cabecalho-da-conversa.component";

describe("CabecalhoDaConversa", () => {
  it("mostra o contato e a empresa", () => {
    render(<CabecalhoDaConversa titulo="Maria" subtitulo="Padaria Ltda" encerrado={false} />);

    expect(screen.getByRole("heading", { name: "Maria" })).toBeInTheDocument();
    expect(screen.getByText("Padaria Ltda")).toBeInTheDocument();
    expect(screen.queryByText("Atendimento encerrado.")).not.toBeInTheDocument();
  });

  it("avisa quando o Atendimento está encerrado", () => {
    render(<CabecalhoDaConversa titulo="Maria" subtitulo="Padaria Ltda" encerrado />);

    expect(screen.getByText("Atendimento encerrado.")).toBeInTheDocument();
  });

  it("mostra de onde veio a transferência e o resumo do assunto", () => {
    render(
      <CabecalhoDaConversa
        titulo="Maria"
        subtitulo="Padaria Ltda"
        encerrado={false}
        transferencia={{ origem: "Transferido por Ana · Recepção", resumo: "Dúvida no DAS" }}
      />,
    );

    expect(screen.getByText("Transferido por Ana · Recepção:")).toBeInTheDocument();
    expect(screen.getByText(/Dúvida no DAS/)).toBeInTheDocument();
  });
});
