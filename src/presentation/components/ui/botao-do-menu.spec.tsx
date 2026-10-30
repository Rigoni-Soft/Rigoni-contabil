import { act, render, screen } from "@testing-library/react";

import { BotaoDoMenu } from "./botao-do-menu";

describe("BotaoDoMenu", () => {
  it("aponta para o painel e espelha o evento toggle dele em aria-expanded", () => {
    render(
      <>
        <BotaoDoMenu alvoId="menu" />
        <div id="menu" popover="auto" />
      </>,
    );
    const botao = screen.getByRole("button", { name: "Menu" });
    const painel = document.getElementById("menu")!;
    const alternar = (newState: string) =>
      act(() => {
        painel.dispatchEvent(Object.assign(new Event("toggle"), { newState }));
      });

    expect(botao).toHaveAttribute("aria-controls", "menu");
    expect(botao).toHaveAttribute("popovertarget", "menu");
    expect(botao).toHaveAttribute("aria-expanded", "false");

    alternar("open");
    expect(botao).toHaveAttribute("aria-expanded", "true");

    alternar("closed");
    expect(botao).toHaveAttribute("aria-expanded", "false");
  });
});
