import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EscolhaDeContato, type ExistentesDaLinha } from "./escolha-de-contato.component";

const EXISTENTES: ExistentesDaLinha = {
  opcoes: [
    { id: "c-1", nome: "Ana", telefone: "(11) 99999-0000", email: "ana@exemplo.com" },
    { id: "c-2", nome: "Bia", telefone: "", email: "bia@exemplo.com" },
  ],
  modoNovo: false,
  onEscolher: jest.fn(),
  onNovo: jest.fn(),
};

describe("EscolhaDeContato", () => {
  beforeEach(() => jest.clearAllMocks());

  it("Nome, WhatsApp e E-mail viram seleções; só o Nome é obrigatório", () => {
    render(<EscolhaDeContato indice={0} existentes={EXISTENTES} erros={{}} />);

    expect(screen.getByLabelText(/^Nome/)).toBeRequired();
    expect(screen.getByLabelText("WhatsApp")).not.toBeRequired();
    expect(screen.getByLabelText("E-mail")).not.toBeRequired();
  });

  it("cada seleção lista o que o campo tem nos contatos, sem as opções vazias, e termina com '+ Cadastrar novo'", () => {
    render(<EscolhaDeContato indice={0} existentes={EXISTENTES} erros={{}} />);

    const whatsapp = screen.getByLabelText("WhatsApp");
    const opcoes = Array.from(whatsapp.querySelectorAll("option")).map((o) => o.textContent);
    expect(opcoes).toEqual(["Escolher contato", "(11) 99999-0000", "+ Cadastrar novo"]);
  });

  it("escolher um contato chama onEscolher com o id dele", async () => {
    const usuario = userEvent.setup();
    render(<EscolhaDeContato indice={0} existentes={EXISTENTES} erros={{}} />);

    await usuario.selectOptions(screen.getByLabelText(/^Nome/), "Bia");

    expect(EXISTENTES.onEscolher).toHaveBeenCalledWith("c-2");
    expect(EXISTENTES.onNovo).not.toHaveBeenCalled();
  });

  it("'+ Cadastrar novo' chama onNovo, em qualquer das três seleções", async () => {
    const usuario = userEvent.setup();
    render(<EscolhaDeContato indice={0} existentes={EXISTENTES} erros={{}} />);

    await usuario.selectOptions(screen.getByLabelText("E-mail"), "+ Cadastrar novo");

    expect(EXISTENTES.onNovo).toHaveBeenCalledTimes(1);
    expect(EXISTENTES.onEscolher).not.toHaveBeenCalled();
  });

  it("o erro de um campo aparece na seleção dele", () => {
    render(
      <EscolhaDeContato
        indice={0}
        existentes={EXISTENTES}
        erros={{ telefone: "Informe o WhatsApp ou o e-mail." }}
      />,
    );

    expect(screen.getByText("Informe o WhatsApp ou o e-mail.")).toBeInTheDocument();
  });
});
