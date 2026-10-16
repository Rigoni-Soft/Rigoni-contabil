import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ok } from "@/shared/kernel/result";

import { CriarUsuarioContainer } from "./criar-usuario.container";

const executeMock = jest.fn();

jest.mock("@/main/usuarios.factory", () => ({
  makeCriarUsuario: () => ({ execute: executeMock }),
}));

describe("CriarUsuarioContainer", () => {
  beforeEach(() => executeMock.mockReset());

  it("submete o formulário preenchido e mostra a senha provisória devolvida pelo caso de uso", async () => {
    executeMock.mockResolvedValue(
      ok({
        usuario: {
          id: "1",
          nome: "Jéssica Souza",
          email: "jessica@rigonicontabil.local",
          papel: "funcionario",
          setor: "simples_nacional",
        },
        senhaProvisoria: "ABCDEFGHJKLM",
      }),
    );
    const usuario = userEvent.setup();
    render(
      <CriarUsuarioContainer
        papeisDisponiveis={["lider_setor", "funcionario"]}
        setoresDisponiveis={["simples_nacional"]}
      />,
    );

    await usuario.type(screen.getByLabelText("Nome"), "Jéssica Souza");
    await usuario.type(screen.getByLabelText("E-mail"), "jessica@rigonicontabil.local");
    await usuario.selectOptions(screen.getByLabelText("Papel"), "funcionario");
    await usuario.selectOptions(screen.getByLabelText("Setor"), "simples_nacional");
    await usuario.click(screen.getByRole("button", { name: "Cadastrar" }));

    expect(await screen.findByText("ABCDEFGHJKLM")).toBeInTheDocument();
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  // Promise rejeitada (erro de rede/transporte, não um ActionResult de erro) não
  // pode deixar o botão preso em "Cadastrando...".
  it("Promise rejeitada limpa o estado pendente e mostra erro genérico", async () => {
    executeMock.mockRejectedValue(new Error("falha de rede"));
    const usuario = userEvent.setup();
    render(
      <CriarUsuarioContainer
        papeisDisponiveis={["lider_setor", "funcionario"]}
        setoresDisponiveis={["simples_nacional"]}
      />,
    );

    await usuario.type(screen.getByLabelText("Nome"), "Jéssica Souza");
    await usuario.type(screen.getByLabelText("E-mail"), "jessica@rigonicontabil.local");
    await usuario.selectOptions(screen.getByLabelText("Papel"), "funcionario");
    await usuario.selectOptions(screen.getByLabelText("Setor"), "simples_nacional");
    await usuario.click(screen.getByRole("button", { name: "Cadastrar" }));

    expect(await screen.findByText("Falha inesperada. Tente novamente.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cadastrar" })).toBeEnabled();
  });

  it("'Cadastrar outro' volta pro formulário limpo, com Papel/Setor travados de novo (Líder)", async () => {
    executeMock.mockResolvedValue(
      ok({
        usuario: {
          id: "1",
          nome: "Jéssica Souza",
          email: "jessica@rigonicontabil.local",
          papel: "funcionario",
          setor: "contabil",
        },
        senhaProvisoria: "ABCDEFGHJKLM",
      }),
    );
    const usuario = userEvent.setup();
    render(
      <CriarUsuarioContainer
        papeisDisponiveis={["funcionario"]}
        setoresDisponiveis={["contabil"]}
      />,
    );

    await usuario.type(screen.getByLabelText("Nome"), "Jéssica Souza");
    await usuario.type(screen.getByLabelText("E-mail"), "jessica@rigonicontabil.local");
    await usuario.click(screen.getByRole("button", { name: "Cadastrar" }));
    await screen.findByText("ABCDEFGHJKLM");

    await usuario.click(screen.getByRole("button", { name: "Cadastrar outro" }));

    expect(screen.queryByText("ABCDEFGHJKLM")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("");
    expect(screen.getByLabelText("E-mail")).toHaveValue("");
    expect(screen.getByLabelText("Papel")).toBeDisabled();
    expect(screen.getByLabelText("Papel")).toHaveValue("funcionario");
    expect(screen.getByLabelText("Setor")).toBeDisabled();
    expect(screen.getByLabelText("Setor")).toHaveValue("contabil");
  });
});
