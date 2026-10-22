import { act, render } from "@testing-library/react";

import { useFocoAoDestacar } from "./use-foco-ao-destacar.hook";

function Tela({ destacar }: { destacar: boolean }) {
  const ref = useFocoAoDestacar(destacar);
  return (
    <>
      <button type="button">outro</button>
      <button type="button" ref={ref}>
        alvo
      </button>
    </>
  );
}

const alvo = () => document.querySelectorAll("button")[1];

// Navegador: focus() num elemento oculto (visibility: hidden) não faz nada. `ocultoAte` conta as
// chamadas que não pegam, como as da hidratação lenta.
function focoQueNaoPegaAte(ocultoAte: number) {
  const original = HTMLElement.prototype.focus;
  let chamadas = 0;
  const espiao = jest.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (
    this: HTMLElement,
    ...args
  ) {
    chamadas += 1;
    if (chamadas > ocultoAte) original.apply(this, args);
  });
  return espiao;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("useFocoAoDestacar (#144)", () => {
  it("destacar: foca o botão no mount", () => {
    render(<Tela destacar />);

    expect(alvo()).toHaveFocus();
  });

  it("sem destacar: não foca nada", () => {
    render(<Tela destacar={false} />);

    expect(alvo()).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });

  it("elemento ainda oculto (hidratação lenta): tenta de novo a cada quadro até pegar", () => {
    const foco = focoQueNaoPegaAte(3);
    render(<Tela destacar />);
    expect(alvo()).not.toHaveFocus();

    act(() => jest.advanceTimersByTime(16 * 10));

    expect(alvo()).toHaveFocus();
    expect(foco).toHaveBeenCalledTimes(4);
  });

  it("não insiste para sempre: desiste depois do limite de tentativas", () => {
    const foco = focoQueNaoPegaAte(Number.POSITIVE_INFINITY);
    render(<Tela destacar />);

    act(() => jest.advanceTimersByTime(60_000));

    expect(alvo()).not.toHaveFocus();
    expect(foco.mock.calls.length).toBeGreaterThan(10);
    expect(foco.mock.calls.length).toBeLessThanOrEqual(200);
  });

  it("não rouba o foco de quem já foi para outro controle durante as tentativas", () => {
    const original = HTMLElement.prototype.focus;
    const tentativasNoAlvo = jest.fn();
    jest.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (
      this: HTMLElement,
      ...args
    ) {
      if (this === alvo()) tentativasNoAlvo();
      else original.apply(this, args);
    });
    render(<Tela destacar />);
    const antes = tentativasNoAlvo.mock.calls.length;
    const outro = document.querySelectorAll("button")[0];

    act(() => outro.focus());
    act(() => jest.advanceTimersByTime(16 * 10));

    expect(outro).toHaveFocus();
    expect(tentativasNoAlvo).toHaveBeenCalledTimes(antes);
  });

  it("desmontar cancela as tentativas pendentes", () => {
    const foco = focoQueNaoPegaAte(Number.POSITIVE_INFINITY);
    const { unmount } = render(<Tela destacar />);
    const chamadasAoDesmontar = () => foco.mock.calls.length;

    unmount();
    const antes = chamadasAoDesmontar();
    act(() => jest.advanceTimersByTime(1_000));

    expect(chamadasAoDesmontar()).toBe(antes);
  });
});
