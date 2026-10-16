import { render, screen } from "@testing-library/react";

import { CarregandoPage } from "./carregando.page";

describe("CarregandoPage", () => {
  it("anuncia o carregamento como status", () => {
    render(<CarregandoPage />);

    expect(screen.getByRole("status")).toHaveTextContent("Carregando…");
  });
});
