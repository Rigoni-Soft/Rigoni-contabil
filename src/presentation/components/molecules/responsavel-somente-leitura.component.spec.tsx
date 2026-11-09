import { render, screen } from "@testing-library/react";

import { ResponsavelSomenteLeitura } from "./responsavel-somente-leitura.component";

describe("ResponsavelSomenteLeitura", () => {
  it("mostra o nome do Responsável num campo desabilitado com rótulo", () => {
    render(<ResponsavelSomenteLeitura nome="Funcionário RH" />);

    expect(screen.getByLabelText("Responsável")).toHaveValue("Funcionário RH");
    expect(screen.getByLabelText("Responsável")).toBeDisabled();
  });
});
