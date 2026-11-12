import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EnvioDeConvencao } from "./envio-de-convencao.component";

const base = {
  chave: 0,
  pendente: false,
  onArquivo: jest.fn(),
  onEnviar: jest.fn(),
};

describe("EnvioDeConvencao", () => {
  beforeEach(() => jest.clearAllMocks());

  it("não pede sindicato nem vigência: saem do PDF", () => {
    render(<EnvioDeConvencao {...base} />);

    expect(screen.queryByLabelText(/Sindicato/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/vigência/)).not.toBeInTheDocument();
  });

  it("avisa o container ao enviar", async () => {
    render(<EnvioDeConvencao {...base} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Enviar convenção" }));

    expect(base.onEnviar).toHaveBeenCalledTimes(1);
  });

  it("mostra o arquivo escolhido e a dica do limite antes do envio", () => {
    render(
      <EnvioDeConvencao
        {...base}
        arquivo={new File(["x"], "cct-2026.pdf", { type: "application/pdf" })}
      />,
    );

    expect(screen.getByText("cct-2026.pdf")).toBeInTheDocument();
    expect(screen.getAllByText("PDF de até 4 MB").length).toBeGreaterThan(0);
  });

  it("erro do arquivo aparece no próprio campo do PDF", () => {
    render(
      <EnvioDeConvencao {...base} erro="Escolha o PDF da convenção." campoComErro="arquivo" />,
    );

    expect(screen.getByText("Escolha o PDF da convenção.")).toBeInTheDocument();
    expect(screen.getByLabelText("Convenção (PDF)")).toBeInvalid();
  });

  it("enquanto lê, desabilita o botão e diz o que acontece; o erro aparece em alerta", () => {
    render(<EnvioDeConvencao {...base} pendente erro="Não foi possível ler a convenção." />);

    expect(screen.getByRole("button", { name: "Lendo a convenção…" })).toBeDisabled();
    expect(screen.getByText("Não foi possível ler a convenção.")).toBeInTheDocument();
  });
});
