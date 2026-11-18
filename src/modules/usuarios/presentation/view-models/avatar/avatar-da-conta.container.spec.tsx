import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AvatarDaContaContainer } from "./avatar-da-conta.container";

const useHookMock = jest.fn();

jest.mock("./use-avatar-da-conta.hook", () => ({
  ID_DO_ESCOLHER_FOTO: "escolher",
  useAvatarDaConta: () => useHookMock(),
}));

function hook(sobrescrever = {}) {
  return {
    previaSrc: undefined,
    acao: undefined,
    erro: undefined,
    aoEscolher: jest.fn(),
    aoSalvar: jest.fn(),
    aoCancelar: jest.fn(),
    aoRemover: jest.fn(),
    ...sobrescrever,
  };
}

describe("AvatarDaContaContainer", () => {
  it("sem foto mostra a logo do Setor e o Escolher foto", () => {
    useHookMock.mockReturnValue(hook());
    render(
      <AvatarDaContaContainer papel="funcionario" setor="contabil" avatarAtualizadoEm={null} />,
    );

    expect(document.querySelector("img")).toHaveAttribute("src", "/logos/logo-contabil.jpeg");
    expect(screen.getByLabelText("Escolher foto")).toBeInTheDocument();
  });

  it("com foto mostra a rota do avatar versionada e liga o Remover foto ao hook", async () => {
    const aoRemover = jest.fn();
    useHookMock.mockReturnValue(hook({ aoRemover }));
    render(
      <AvatarDaContaContainer
        papel="funcionario"
        setor="contabil"
        avatarAtualizadoEm="2026-11-18T10:00:00.000Z"
      />,
    );

    expect(document.querySelector("img")).toHaveAttribute(
      "src",
      "/api/avatar?v=2026-11-18T10%3A00%3A00.000Z",
    );
    await userEvent.click(screen.getByRole("button", { name: "Remover foto" }));

    expect(aoRemover).toHaveBeenCalled();
  });
});
