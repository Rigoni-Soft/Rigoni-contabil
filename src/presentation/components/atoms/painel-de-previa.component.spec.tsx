import { render, screen } from "@testing-library/react";

import { PainelDePrevia } from "@/presentation/components/atoms/painel-de-previa.component";
import type { PreviaCarregada } from "@/presentation/lib/previa-de-office";

function renderizar(
  estado: "fechado" | "carregando" | "erro" | "pronto",
  previa?: PreviaCarregada,
) {
  render(
    <PainelDePrevia
      nome="contrato.xlsx"
      painelId="p"
      estado={estado}
      previa={previa}
      aoAbrir={jest.fn()}
    />,
  );
}

describe("PainelDePrevia", () => {
  it("anuncia o carregamento como status", () => {
    renderizar("carregando");
    expect(screen.getByRole("status")).toHaveTextContent("Carregando o arquivo");
  });

  it("falha diz o que fazer em seguida", () => {
    renderizar("erro");
    expect(screen.getByRole("alert")).toHaveTextContent("use Baixar");
  });

  it("planilha vazia mostra aviso em vez de tabela vazia", () => {
    renderizar("pronto", { tipo: "planilha", nome: "Plan1", linhas: [], truncada: false });
    expect(screen.getByText("Esta planilha não tem conteúdo.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("documento sem conteúdo mostra aviso em vez de quadro em branco", () => {
    renderizar("pronto", { tipo: "documento", html: "  " });
    expect(screen.getByText("Este documento não tem conteúdo.")).toBeInTheDocument();
  });

  it("planilha cortada informa quantas linhas aparecem e nomeia a tabela", () => {
    renderizar("pronto", {
      tipo: "planilha",
      nome: "Plan1",
      linhas: [["a"], ["b"]],
      truncada: true,
    });
    expect(screen.getByRole("table", { name: "Plan1" })).toBeInTheDocument();
    expect(screen.getByText(/primeiras 2 linhas/)).toBeInTheDocument();
  });
});
