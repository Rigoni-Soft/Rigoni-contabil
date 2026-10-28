import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AbasDeAtendimento } from "./abas-de-atendimento.component";

const ABAS = [
  { valor: "a", rotulo: "Primeira", contador: 0 },
  { valor: "b", rotulo: "Segunda", contador: 3 },
  { valor: "c", rotulo: "Terceira", contador: 0 },
] as const;

function renderizar(ativa: "a" | "b" | "c" = "a") {
  const onEscolher = jest.fn();
  render(<AbasDeAtendimento abas={[...ABAS]} ativa={ativa} onEscolher={onEscolher} />);
  return { onEscolher };
}

describe("AbasDeAtendimento", () => {
  it("só a aba ativa entra na ordem do Tab", () => {
    renderizar("b");

    expect(screen.getByRole("tab", { name: /Primeira/ })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tab", { name: /Segunda/ })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: /Terceira/ })).toHaveAttribute("tabindex", "-1");
  });

  it("seta para a direita ativa a próxima e leva o foco; na última volta à primeira", async () => {
    const { onEscolher } = renderizar("a");
    screen.getByRole("tab", { name: /Primeira/ }).focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(onEscolher).toHaveBeenLastCalledWith("b");
    expect(screen.getByRole("tab", { name: /Segunda/ })).toHaveFocus();

    screen.getByRole("tab", { name: /Terceira/ }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onEscolher).toHaveBeenLastCalledWith("a");
  });

  it("seta para a esquerda na primeira vai à última; Home e End vão às pontas", async () => {
    const { onEscolher } = renderizar("a");
    screen.getByRole("tab", { name: /Primeira/ }).focus();

    await userEvent.keyboard("{ArrowLeft}");
    expect(onEscolher).toHaveBeenLastCalledWith("c");

    await userEvent.keyboard("{Home}");
    expect(onEscolher).toHaveBeenLastCalledWith("a");
    await userEvent.keyboard("{End}");
    expect(onEscolher).toHaveBeenLastCalledWith("c");
  });

  it("outras teclas não mexem nas abas", async () => {
    const { onEscolher } = renderizar("a");
    screen.getByRole("tab", { name: /Primeira/ }).focus();

    await userEvent.keyboard("x");

    expect(onEscolher).not.toHaveBeenCalled();
  });
});
