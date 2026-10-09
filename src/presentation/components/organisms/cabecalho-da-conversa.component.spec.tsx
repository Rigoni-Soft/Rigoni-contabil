import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

  it("mostra de onde veio a transferência e o resumo do assunto, sem botão quando é curto", () => {
    render(
      <CabecalhoDaConversa
        titulo="Maria"
        subtitulo="Padaria Ltda"
        encerrado={false}
        contexto={{ origem: "Transferido por Ana · Recepção", resumo: "Dúvida no DAS" }}
      />,
    );

    const contexto = screen.getByRole("region", { name: "Contexto do Atendimento" });
    expect(contexto).toHaveTextContent("Transferido por Ana · Recepção");
    expect(contexto).toHaveTextContent("Dúvida no DAS");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("resumo longo vem recolhido e o botão expande e recolhe", async () => {
    render(
      <CabecalhoDaConversa
        titulo="Maria"
        subtitulo="Padaria Ltda"
        encerrado={false}
        contexto={{ origem: "Transferido por Ana · Recepção", resumo: "x".repeat(300) }}
      />,
    );
    const resumo = document.getElementById("resumo-do-contexto")!;
    expect(resumo).toHaveClass("line-clamp-3");

    await userEvent.click(screen.getByRole("button", { name: "Ler resumo completo" }));
    expect(resumo).not.toHaveClass("line-clamp-3");
    expect(screen.getByRole("button", { name: "Mostrar menos" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});
