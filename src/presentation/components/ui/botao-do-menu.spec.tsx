import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BotaoDoMenu } from "./botao-do-menu";

function montar() {
  render(
    <>
      <BotaoDoMenu alvoId="menu" />
      <div id="menu" popover="auto">
        <a href="/perfil">Meu perfil</a>
      </div>
      <p>fora</p>
    </>,
  );
  return {
    botao: screen.getByRole("button", { name: "Menu" }),
    painel: document.getElementById("menu")!,
  };
}

describe("BotaoDoMenu", () => {
  it("aponta para o painel e começa fechado", () => {
    const { botao } = montar();

    expect(botao).toHaveAttribute("aria-controls", "menu");
    expect(botao).toHaveAttribute("popovertarget", "menu");
    expect(botao).toHaveAttribute("aria-expanded", "false");
  });

  describe("com popover nativo", () => {
    beforeEach(() =>
      Object.defineProperty(HTMLElement.prototype, "popover", { value: "", configurable: true }),
    );
    afterEach(() => Reflect.deleteProperty(HTMLElement.prototype, "popover"));

    it("espelha o evento toggle do painel em aria-expanded e não alterna sozinho", async () => {
      const { botao, painel } = montar();

      await userEvent.click(botao);
      expect(botao).toHaveAttribute("aria-expanded", "false");

      act(() => {
        painel.dispatchEvent(Object.assign(new Event("toggle"), { newState: "open" }));
      });
      expect(botao).toHaveAttribute("aria-expanded", "true");

      act(() => {
        painel.dispatchEvent(Object.assign(new Event("toggle"), { newState: "closed" }));
      });
      expect(botao).toHaveAttribute("aria-expanded", "false");
    });
  });

  describe("sem popover no navegador (fallback)", () => {
    it("o botão abre e fecha o painel (data-aberto) e atualiza aria-expanded", async () => {
      const { botao, painel } = montar();
      expect(painel).toHaveAttribute("data-aberto", "false");

      await userEvent.click(botao);
      expect(botao).toHaveAttribute("aria-expanded", "true");
      expect(painel).toHaveAttribute("data-aberto", "true");

      await userEvent.click(botao);
      expect(botao).toHaveAttribute("aria-expanded", "false");
      expect(painel).toHaveAttribute("data-aberto", "false");
    });

    it("Esc fecha", async () => {
      const { botao, painel } = montar();
      await userEvent.click(botao);

      await userEvent.keyboard("{Escape}");

      expect(botao).toHaveAttribute("aria-expanded", "false");
      expect(painel).toHaveAttribute("data-aberto", "false");
    });

    it("clicar fora fecha; clicar dentro do painel não", async () => {
      const { botao } = montar();
      await userEvent.click(botao);

      await userEvent.click(screen.getByRole("link", { name: "Meu perfil" }));
      expect(botao).toHaveAttribute("aria-expanded", "true");

      await userEvent.click(screen.getByText("fora"));
      expect(botao).toHaveAttribute("aria-expanded", "false");
    });
  });
});
