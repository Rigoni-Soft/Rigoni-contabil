import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AvatarDaConta } from "./avatar-da-conta.component";

function montar(props: Partial<React.ComponentProps<typeof AvatarDaConta>> = {}) {
  const acoes = {
    aoEscolher: jest.fn(),
    aoSalvar: jest.fn(),
    aoCancelar: jest.fn(),
    aoRemover: jest.fn(),
  };
  render(
    <AvatarDaConta
      srcAtual="/logos/logo-contabil.jpeg"
      temFoto={false}
      pendente={false}
      idDoEscolher="escolher"
      aceitar="image/jpeg,image/png,image/webp"
      {...acoes}
      {...props}
    />,
  );
  return acoes;
}

describe("AvatarDaConta", () => {
  it("diz o que acontece com a foto, sem checkbox de consentimento", () => {
    montar();

    expect(
      screen.getByText("Sua foto fica guardada no sistema e só você a vê. Remova quando quiser."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText("JPEG, PNG ou WebP, até 5 MB.")).toBeInTheDocument();
  });

  it("sem foto oferece Escolher foto e não mostra Remover foto", () => {
    montar();

    expect(screen.getByLabelText("Escolher foto")).toHaveAttribute("type", "file");
    expect(screen.queryByRole("button", { name: "Remover foto" })).not.toBeInTheDocument();
  });

  it("com foto oferece Trocar foto e Remover foto, que chama a ação", async () => {
    const { aoRemover } = montar({ temFoto: true, srcAtual: "/api/avatar?v=1" });

    expect(screen.getByLabelText("Trocar foto")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remover foto" }));

    expect(aoRemover).toHaveBeenCalled();
  });

  it("mostra a imagem atual redonda", () => {
    montar({ temFoto: true, srcAtual: "/api/avatar?v=1" });

    const imagem = document.querySelector("img");
    expect(imagem).toHaveAttribute("src", "/api/avatar?v=1");
    expect(imagem?.className).toMatch(/rounded-full/);
  });

  it("com prévia mostra a imagem recortada e Salvar foto/Cancelar no lugar do seletor", async () => {
    const { aoSalvar, aoCancelar } = montar({ previaSrc: "blob:previa", temFoto: true });

    expect(document.querySelector("img")).toHaveAttribute("src", "blob:previa");
    expect(screen.queryByLabelText("Trocar foto")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover foto" })).not.toBeInTheDocument();

    const salvar = screen.getByRole("button", { name: "Salvar foto" });
    expect(salvar).toHaveFocus();
    await userEvent.click(salvar);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(aoSalvar).toHaveBeenCalled();
    expect(aoCancelar).toHaveBeenCalled();
  });

  it("em andamento, os botões ficam focáveis com aria-disabled e não disparam a ação", async () => {
    const { aoSalvar } = montar({ previaSrc: "blob:previa", pendente: true });

    const salvar = screen.getByRole("button", { name: "Salvando…" });
    expect(salvar).toHaveAttribute("aria-disabled", "true");
    expect(salvar).not.toBeDisabled();
    await userEvent.click(salvar);

    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it("mostra o aviso de formato ou tamanho como alerta", () => {
    montar({ erro: "A foto passa de 5 MB. Escolha uma menor." });

    expect(screen.getByRole("alert")).toHaveTextContent("A foto passa de 5 MB");
  });

  it("entrega o arquivo escolhido", async () => {
    const { aoEscolher } = montar();
    const arquivo = new File(["x"], "foto.png", { type: "image/png" });

    await userEvent.upload(screen.getByLabelText("Escolher foto"), arquivo);

    expect(aoEscolher).toHaveBeenCalledWith(arquivo);
  });
});
