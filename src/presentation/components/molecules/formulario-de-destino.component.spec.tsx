import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  FormularioDeDestino,
  type FormularioDeDestinoValores,
} from "./formulario-de-destino.component";

const BASE: FormularioDeDestinoValores = {
  modo: "existente",
  opcoesDeContato: [
    { valor: "c-1", rotulo: "(11) 99999-0000" },
    { valor: "c-2", rotulo: "bia@exemplo.com" },
  ],
  opcoesDeTipo: [
    { valor: "", rotulo: "Todos os envios do Setor" },
    { valor: "das", rotulo: "DAS" },
  ],
  contatoId: "",
  novo: { nome: "", telefone: "", email: "" },
  tipo: "",
  canal: "",
  canais: { opcoes: [] },
  erros: {},
  pendente: false,
};

function montar(valores: Partial<FormularioDeDestinoValores> = {}) {
  const acoes = {
    onEscolherContato: jest.fn(),
    onMudarNovo: jest.fn(),
    onMudarTipo: jest.fn(),
    onMudarCanal: jest.fn(),
    onNovoContato: jest.fn(),
    onVoltar: jest.fn(),
    onUsarExistente: jest.fn(),
    onAdicionar: jest.fn(),
  };
  render(
    <FormularioDeDestino
      valores={{ ...BASE, ...valores }}
      idDoSelect="destino-contato"
      {...acoes}
    />,
  );
  return acoes;
}

describe("FormularioDeDestino", () => {
  it("contato cadastrado: escolher chama o callback; nome e e-mail vêm travados", async () => {
    const acoes = montar({
      contatoId: "c-2",
      escolhido: { nome: "Bia", email: "bia@exemplo.com" },
    });
    const usuario = userEvent.setup();

    await usuario.selectOptions(screen.getByLabelText("WhatsApp ou e-mail do contato"), "c-1");

    expect(acoes.onEscolherContato).toHaveBeenCalledWith("c-1");
    expect(screen.getByLabelText("Nome")).toHaveValue("Bia");
    expect(screen.getByLabelText("Nome")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("E-mail")).toHaveValue("bia@exemplo.com");
  });

  it("'Novo contato' troca o select pelos campos do contato novo, e há botão para voltar", async () => {
    const aberto = montar();
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: "Novo contato" }));
    expect(aberto.onNovoContato).toHaveBeenCalledTimes(1);
  });

  it("modo novo: nome obrigatório, WhatsApp e e-mail, e 'Escolher contato já cadastrado' volta", async () => {
    const acoes = montar({ modo: "novo" });
    const usuario = userEvent.setup();

    expect(screen.getByLabelText(/^Nome/)).toBeRequired();
    expect(screen.getByLabelText("WhatsApp")).toBeInTheDocument();
    expect(screen.queryByLabelText("WhatsApp ou e-mail do contato")).not.toBeInTheDocument();
    await usuario.type(screen.getByLabelText(/^Nome/), "D");
    await usuario.click(screen.getByRole("button", { name: "Escolher contato já cadastrado" }));

    expect(acoes.onMudarNovo).toHaveBeenCalledWith("nome", "D");
    expect(acoes.onVoltar).toHaveBeenCalledTimes(1);
  });

  it("canal único aparece travado e preenchido; dois canais pedem escolha (select)", async () => {
    const unico = montar({
      contatoId: "c-1",
      canais: { opcoes: [{ valor: "email", rotulo: "E-mail" }], unico: "email" },
      canal: "email",
    });
    expect(screen.getByLabelText("Forma de envio")).toHaveValue("E-mail");
    expect(screen.getByLabelText("Forma de envio")).toHaveAttribute("readonly");
    expect(unico.onMudarCanal).not.toHaveBeenCalled();
  });

  it("dois canais: select 'Escolha…' sem padrão e o callback recebe a escolha", async () => {
    const acoes = montar({
      contatoId: "c-1",
      canais: {
        opcoes: [
          { valor: "whatsapp", rotulo: "WhatsApp" },
          { valor: "email", rotulo: "E-mail" },
          { valor: "whatsapp_e_email", rotulo: "WhatsApp e E-mail" },
        ],
      },
    });
    const usuario = userEvent.setup();

    expect(screen.getByLabelText("Forma de envio")).toHaveValue("");
    await usuario.selectOptions(screen.getByLabelText("Forma de envio"), "whatsapp_e_email");

    expect(acoes.onMudarCanal).toHaveBeenCalledWith("whatsapp_e_email");
  });

  it("o tipo de envio lista 'Todos os envios do Setor' e o catálogo", async () => {
    const acoes = montar();
    const usuario = userEvent.setup();

    await usuario.selectOptions(screen.getByLabelText("Tipo de envio"), "das");

    expect(acoes.onMudarTipo).toHaveBeenCalledWith("das");
    expect(screen.getByRole("option", { name: "Todos os envios do Setor" })).toBeInTheDocument();
  });

  it("Adicionar chama o callback; Enter num campo adiciona sem enviar o cadastro", async () => {
    const acoes = montar({ modo: "novo" });
    const usuario = userEvent.setup();

    await usuario.click(screen.getByRole("button", { name: "Adicionar destino" }));
    await usuario.type(screen.getByLabelText(/^Nome/), "{Enter}");

    expect(acoes.onAdicionar).toHaveBeenCalledTimes(2);
  });

  it("ocupado: o botão fica aria-disabled (mantém o foco) e não adiciona", async () => {
    const acoes = montar({ pendente: true });
    const usuario = userEvent.setup();

    const botao = screen.getByRole("button", { name: "Adicionar destino" });
    await usuario.click(botao);

    expect(botao).toHaveAttribute("aria-disabled", "true");
    expect(botao).toBeEnabled();
    expect(acoes.onAdicionar).not.toHaveBeenCalled();
  });

  it("mostra o contato existente quando o WhatsApp ou e-mail já é do Cliente, com 'Usar este contato'", async () => {
    const acoes = montar({ modo: "novo", repetido: { id: "c-1", nome: "Ana" } });
    const usuario = userEvent.setup();

    expect(screen.getByText(/já tem um contato com esse WhatsApp ou e-mail: Ana/)).toBeVisible();
    await usuario.click(screen.getByRole("button", { name: "Usar este contato" }));

    expect(acoes.onUsarExistente).toHaveBeenCalledWith("c-1");
  });

  it("mostra os erros dos campos e o erro do servidor", () => {
    montar({
      modo: "novo",
      erros: { nome: "obrigatório", telefone: "Informe o WhatsApp ou o e-mail" },
      erroGeral: "Falha ao salvar.",
    });

    expect(screen.getByText("obrigatório")).toBeInTheDocument();
    expect(screen.getByText("Informe o WhatsApp ou o e-mail")).toBeInTheDocument();
    expect(screen.getByText("Falha ao salvar.")).toBeInTheDocument();
  });
});
