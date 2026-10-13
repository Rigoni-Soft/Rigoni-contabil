import { render, screen } from "@testing-library/react";

import { AvisoDeStatus } from "./aviso-de-status.component";

describe("AvisoDeStatus", () => {
  it("erro é anunciado como alerta", () => {
    render(<AvisoDeStatus tipo="erro" texto="Falhou" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Falhou");
  });

  it("sucesso é anunciado como status", () => {
    render(<AvisoDeStatus tipo="sucesso" texto="Enviado" />);

    expect(screen.getByRole("status")).toHaveTextContent("Enviado");
  });
});
