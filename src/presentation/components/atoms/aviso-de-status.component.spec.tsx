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

  it("atenção é anunciada como status, sem o check do sucesso", () => {
    const { container } = render(<AvisoDeStatus tipo="atencao" texto="Confira" />);

    expect(screen.getByRole("status")).toHaveTextContent("Confira");
    expect(container.querySelector("svg.lucide-circle-check")).toBeNull();
  });
});
