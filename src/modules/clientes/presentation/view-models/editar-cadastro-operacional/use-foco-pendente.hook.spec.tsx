import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useFocoPendente } from "./use-foco-pendente.hook";

function Tela({ comAlvoDeInicio }: { comAlvoDeInicio: boolean }) {
  const [mostrando, setMostrando] = useState(comAlvoDeInicio);
  const focar = useFocoPendente();
  return (
    <>
      <button type="button" onClick={() => focar("alvo")}>
        Focar
      </button>
      <button type="button" onClick={() => setMostrando(true)}>
        Mostrar
      </button>
      {mostrando && <input id="alvo" aria-label="Alvo" />}
    </>
  );
}

describe("useFocoPendente", () => {
  it("foca o elemento que já está na tela", async () => {
    render(<Tela comAlvoDeInicio />);

    await userEvent.click(screen.getByText("Focar"));

    expect(screen.getByLabelText("Alvo")).toHaveFocus();
  });

  it("o alvo que só aparece depois da renderização recebe o foco quando surge", async () => {
    const usuario = userEvent.setup();
    render(<Tela comAlvoDeInicio={false} />);

    await usuario.click(screen.getByText("Focar"));
    expect(screen.queryByLabelText("Alvo")).toBeNull();
    await usuario.click(screen.getByText("Mostrar"));

    expect(screen.getByLabelText("Alvo")).toHaveFocus();
  });
});
