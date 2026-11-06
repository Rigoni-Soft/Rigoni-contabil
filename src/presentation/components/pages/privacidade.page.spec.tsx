import { render, screen } from "@testing-library/react";

import { PrivacidadePage } from "./privacidade.page";

describe("PrivacidadePage", () => {
  it("identifica o controlador e dá o contato para os direitos do titular", () => {
    render(<PrivacidadePage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Política de Privacidade" }),
    ).toBeVisible();
    expect(screen.getAllByText(/12\.246\.616\/0001-26/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/rigonicontabilidadepatriki@gmail\.com/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /Seus direitos/ })).toBeVisible();
    expect(screen.getByRole("heading", { name: /Exclusão de dados/ })).toBeVisible();
  });
});
