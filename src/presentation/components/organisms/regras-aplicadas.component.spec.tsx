import { render, screen, within } from "@testing-library/react";

import { RegrasAplicadas, type LinhaDeRegra } from "./regras-aplicadas.component";

const APLICADA: LinhaDeRegra = {
  chave: "extra_sabado",
  rotulo: "Hora extra de sábado",
  aplicada: true,
  noCalculo: true,
  valor: "60%",
  legislacao: "50%",
  diferenca: "+10 pontos",
  clausula: "Cláusula 12ª",
  trecho: "adicional de 60%",
  motivo: undefined,
};
const NAO_APLICADA: LinhaDeRegra = {
  chave: "intervalo_maximo",
  rotulo: "Intervalo máximo",
  aplicada: false,
  noCalculo: false,
  valor: "Não aplicada",
  legislacao: "2h",
  diferenca: "vale a legislação",
  clausula: "",
  trecho: "",
  motivo: "O número não aparece no trecho citado",
};

const FORA_DO_CALCULO: LinhaDeRegra = {
  ...APLICADA,
  chave: "jornada_diaria",
  rotulo: "Jornada diária",
  noCalculo: false,
};

describe("RegrasAplicadas", () => {
  it("avisa que a regra extraída que o motor não usa não entra no cálculo", () => {
    render(<RegrasAplicadas titulo="Comércio" linhas={[APLICADA, FORA_DO_CALCULO]} />);

    expect(screen.getAllByText("Não entra no cálculo da Totalização")).toHaveLength(1);
  });

  it("mostra valor, legislação, diferença e a cláusula com o trecho citado", () => {
    render(<RegrasAplicadas titulo="Comércio · 01/05/2026 a 30/04/2027" linhas={[APLICADA]} />);

    const linha = screen.getByRole("row", { name: /Hora extra de sábado/ });
    for (const texto of ["60%", "50%", "+10 pontos", "Cláusula 12ª", "“adicional de 60%”"]) {
      expect(within(linha).getByText(texto)).toBeInTheDocument();
    }
    expect(screen.getByText("Comércio · 01/05/2026 a 30/04/2027")).toBeInTheDocument();
  });

  it("o parâmetro recusado fica 'Não aplicada', com o motivo, sem cláusula", () => {
    render(<RegrasAplicadas titulo="x" linhas={[NAO_APLICADA]} />);

    const linha = screen.getByRole("row", { name: /Intervalo máximo/ });
    expect(within(linha).getByText("Não aplicada")).toBeInTheDocument();
    expect(
      within(linha).getByText("Recusada: O número não aparece no trecho citado"),
    ).toBeInTheDocument();
    expect(within(linha).getByText("vale a legislação")).toBeInTheDocument();
  });
});
