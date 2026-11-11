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

  it("entrega os campos do formulário ao enviar", async () => {
    render(<EnvioDeConvencao {...base} />);
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox", { name: "Sindicato" }), "Comércio");
    await user.type(screen.getByLabelText("Início da vigência"), "2026-05-01");
    await user.type(screen.getByLabelText("Fim da vigência"), "2027-04-30");
    await user.click(screen.getByRole("button", { name: "Enviar convenção" }));

    const campos = base.onEnviar.mock.calls[0][0] as FormData;
    expect(Object.fromEntries(campos)).toMatchObject({
      sindicato: "Comércio",
      vigenciaInicio: "2026-05-01",
      vigenciaFim: "2027-04-30",
    });
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

  it("enquanto lê, desabilita o botão e diz o que acontece; o erro aparece em alerta", () => {
    render(<EnvioDeConvencao {...base} pendente erro="Não foi possível ler a convenção." />);

    expect(screen.getByRole("button", { name: "Lendo a convenção…" })).toBeDisabled();
    expect(screen.getByText("Não foi possível ler a convenção.")).toBeInTheDocument();
  });
});
