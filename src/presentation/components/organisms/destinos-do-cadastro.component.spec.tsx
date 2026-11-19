import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DestinosDoCadastro, type DestinosDoCadastroProps } from "./destinos-do-cadastro.component";

const LINHAS = [
  {
    id: "d-1",
    tipo: "DAS",
    contato: "Ana",
    identificador: "(11) 99999-0000",
    canal: "WhatsApp",
  },
  {
    id: "d-2",
    tipo: "Todos os envios do Setor",
    contato: "Bia",
    identificador: "bia@exemplo.com",
    canal: "E-mail",
    aviso: "O contato deixou de ter o WhatsApp: este envio não sai por ele.",
  },
];

function montar(parcial: Partial<DestinosDoCadastroProps> = {}) {
  const acoes = {
    onEscolherContato: jest.fn(),
    onMudarNovo: jest.fn(),
    onMudarTipo: jest.fn(),
    onMudarCanal: jest.fn(),
    onNovoContato: jest.fn(),
    onVoltar: jest.fn(),
    onUsarExistente: jest.fn(),
    onAdicionar: jest.fn(),
    onRemover: jest.fn(),
  };
  render(
    <DestinosDoCadastro
      linhas={LINHAS}
      idDoSelect="destino-contato"
      somenteLeitura={false}
      formulario={{
        modo: "existente",
        opcoesDeContato: [],
        opcoesDeTipo: [{ valor: "", rotulo: "Todos os envios do Setor" }],
        contatoId: "",
        novo: { nome: "", telefone: "", email: "" },
        tipo: "",
        canal: "",
        canais: { opcoes: [] },
        erros: {},
        pendente: false,
      }}
      {...acoes}
      {...parcial}
    />,
  );
  return acoes;
}

describe("DestinosDoCadastro", () => {
  it("lista cada destino com tipo, contato, identificador e forma de envio", () => {
    montar();

    const [primeiro, segundo] = screen.getAllByRole("listitem");
    expect(within(primeiro).getByText("DAS")).toBeInTheDocument();
    expect(within(primeiro).getByText(/Ana · \(11\) 99999-0000 · WhatsApp/)).toBeInTheDocument();
    expect(within(segundo).getByText("Todos os envios do Setor")).toBeInTheDocument();
  });

  it("avisa, na linha, quando o canal usado pelo destino foi removido do contato", () => {
    montar();

    const [, segundo] = screen.getAllByRole("listitem");
    expect(within(segundo).getByText(/deixou de ter o WhatsApp/)).toBeInTheDocument();
  });

  it("remover chama o callback com o id do destino, por um botão com nome acessível", async () => {
    const acoes = montar();
    const usuario = userEvent.setup();

    await usuario.click(screen.getByRole("button", { name: "Remover destino DAS de Ana" }));

    expect(acoes.onRemover).toHaveBeenCalledWith("d-1");
  });

  it("sem destinos mostra a mensagem de vazio e o formulário segue disponível", () => {
    montar({ linhas: [] });

    expect(screen.getByText(/ainda não tem destino de envio/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Adicionar destino de envio" })).toBeInTheDocument();
  });

  it("somente leitura: só a tabela, sem formulário nem lixeira", () => {
    montar({ somenteLeitura: true });

    expect(screen.queryByRole("group", { name: "Adicionar destino de envio" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remover destino/ })).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("anuncia a confirmação ao leitor de tela numa região polida", () => {
    montar({ aviso: "Destino adicionado." });

    expect(screen.getByText("Destino adicionado.")).toHaveAttribute("aria-live", "polite");
  });
});
