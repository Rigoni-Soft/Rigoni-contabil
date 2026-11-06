import { render, screen } from "@testing-library/react";

import { SeloDaGuia } from "./selo-da-guia.component";

describe("SeloDaGuia", () => {
  it("a confirmar é neutro; liberada ao envio é contorno; enviada é preenchida", () => {
    const { rerender } = render(<SeloDaGuia confirmada={false} />);
    expect(screen.getByText("A confirmar")).toHaveClass("bg-muted");

    rerender(<SeloDaGuia confirmada />);
    const liberada = screen.getByText("Liberada ao envio");
    expect(liberada).toHaveClass("border-primary", "text-primary");
    expect(liberada).not.toHaveClass("bg-primary");

    // Enviada prevalece e é o marco final: não se confunde com liberada à distância.
    rerender(<SeloDaGuia confirmada enviada />);
    expect(screen.getByText("Enviada")).toHaveClass("bg-primary", "text-primary-foreground");
  });
});
