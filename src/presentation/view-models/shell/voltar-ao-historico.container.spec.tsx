import { createEvent, fireEvent, render, screen } from "@testing-library/react";

import { VoltarAoHistoricoContainer } from "./voltar-ao-historico.container";

const back = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ back }) }));

function simular({ historico, referrer }: { historico: number; referrer: string }) {
  jest.spyOn(window.history, "length", "get").mockReturnValue(historico);
  jest.spyOn(document, "referrer", "get").mockReturnValue(referrer);
}

function clicarEmVoltar(init: MouseEventInit = {}) {
  render(<VoltarAoHistoricoContainer />);
  const link = screen.getByRole("link", { name: "Voltar" });
  const evento = createEvent.click(link, init);
  fireEvent(link, evento);
  return evento;
}

describe("VoltarAoHistoricoContainer", () => {
  beforeEach(() => back.mockReset());
  afterEach(() => jest.restoreAllMocks());

  it("vindo de outra tela do sistema, volta à anterior em vez de seguir o link", () => {
    simular({ historico: 3, referrer: `${window.location.origin}/clientes` });

    const evento = clicarEmVoltar();

    expect(back).toHaveBeenCalledTimes(1);
    expect(evento.defaultPrevented).toBe(true);
  });

  it("sem histórico, segue o link para o início e não chama back", () => {
    simular({ historico: 1, referrer: `${window.location.origin}/clientes` });

    const evento = clicarEmVoltar();

    expect(screen.getByRole("link", { name: "Voltar" })).toHaveAttribute("href", "/");
    expect(back).not.toHaveBeenCalled();
    expect(evento.defaultPrevented).toBe(false);
  });

  it("chegando de fora do sistema (link externo ou favorito), segue o link para o início", () => {
    simular({ historico: 4, referrer: "https://exemplo.com/pagina" });

    const evento = clicarEmVoltar();

    expect(back).not.toHaveBeenCalled();
    expect(evento.defaultPrevented).toBe(false);
  });

  it.each([
    ["Ctrl", { ctrlKey: true }],
    ["Cmd", { metaKey: true }],
    ["Shift", { shiftKey: true }],
    ["Alt", { altKey: true }],
    ["botão do meio", { button: 1 }],
  ])("%s-clique fica com o navegador (nova aba), sem back", (_nome, init) => {
    simular({ historico: 3, referrer: `${window.location.origin}/clientes` });

    const evento = clicarEmVoltar(init);

    expect(back).not.toHaveBeenCalled();
    expect(evento.defaultPrevented).toBe(false);
  });
});
