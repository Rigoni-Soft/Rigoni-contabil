import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PainelDeContatoUra } from "./painel-de-contato-ura.component";

function montar(props: Partial<React.ComponentProps<typeof PainelDeContatoUra>> = {}) {
  const acoes = {
    onAbrir: jest.fn(),
    onBuscar: jest.fn(),
    onTrocarCliente: jest.fn(),
    onCadastrar: jest.fn(),
    onCancelar: jest.fn(),
  };
  render(
    <PainelDeContatoUra
      etapa="fechado"
      concluido={false}
      telefone="(61) 98888-7777"
      cnpjSugerido=""
      buscando={false}
      cadastrando={false}
      {...acoes}
      {...props}
    />,
  );
  return acoes;
}

describe("PainelDeContatoUra", () => {
  it("fechado: oferece o botão e explica que o número não é contato de nenhum Cliente", async () => {
    const acoes = montar();
    expect(screen.getByText(/não é contato de nenhum Cliente/i)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Cadastrar como contato deste Cliente" }),
    );
    expect(acoes.onAbrir).toHaveBeenCalledTimes(1);
  });

  it("concluído: mostra o aviso e não oferece cadastrar de novo", () => {
    montar({
      concluido: true,
      aviso: { tipo: "sucesso", texto: "Maria cadastrado como contato." },
    });
    expect(screen.getByText("Maria cadastrado como contato.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cadastrar como contato deste Cliente" }),
    ).not.toBeInTheDocument();
  });

  it("etapa do Cliente: o CNPJ da URA vem preenchido como sugestão e a busca leva o que está no campo", async () => {
    const acoes = montar({ etapa: "cliente", cnpjSugerido: "11.444.777/0001-61" });
    const campo = screen.getByLabelText(/CNPJ do Cliente/);
    expect(campo).toHaveValue("11.444.777/0001-61");
    expect(campo).toHaveFocus();
    expect(screen.getByText(/Sugerido pela URA/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Buscar Cliente" }));
    expect(acoes.onBuscar).toHaveBeenCalledWith("11.444.777/0001-61");
  });

  it("etapa do Cliente sem sugestão não finge que a URA sugeriu", () => {
    montar({ etapa: "cliente" });
    expect(screen.queryByText(/Sugerido pela URA/)).not.toBeInTheDocument();
  });

  it("etapa do contato: mostra o Cliente a confirmar, o WhatsApp do atendimento e envia nome e e-mail", async () => {
    const acoes = montar({
      etapa: "contato",
      cliente: { empresa: "Padaria Ltda", cnpj: "11.444.777/0001-61" },
    });
    expect(screen.getByText(/Padaria Ltda/)).toBeInTheDocument();
    expect(screen.getByText(/\(61\) 98888-7777/)).toBeInTheDocument();
    const nome = screen.getByLabelText(/Nome/);
    expect(nome).toHaveFocus();
    await userEvent.type(nome, "Maria");
    await userEvent.type(screen.getByLabelText(/E-mail/), "maria@padaria.teste");
    await userEvent.click(screen.getByRole("button", { name: "Cadastrar contato" }));
    expect(acoes.onCadastrar).toHaveBeenCalledWith("Maria", "maria@padaria.teste");
  });

  it("etapa do contato: permite trocar o Cliente e cancelar", async () => {
    const acoes = montar({
      etapa: "contato",
      cliente: { empresa: "Padaria Ltda", cnpj: "11.444.777/0001-61" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Trocar Cliente" }));
    expect(acoes.onTrocarCliente).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(acoes.onCancelar).toHaveBeenCalledTimes(1);
  });

  it("ocupado: o botão avisa o andamento e segue focável (aria-disabled)", () => {
    montar({ etapa: "cliente", buscando: true });
    const botao = screen.getByRole("button", { name: "Buscando…" });
    expect(botao).toHaveAttribute("aria-disabled", "true");
  });

  it("mostra o erro da busca ou do cadastro", () => {
    montar({ etapa: "cliente", aviso: { tipo: "erro", texto: "Nenhum Cliente com este CNPJ." } });
    expect(screen.getByText("Nenhum Cliente com este CNPJ.")).toBeInTheDocument();
  });
});
