import { render, screen, within } from "@testing-library/react";

import { ResumoSetorLista } from "./resumo-setor-lista.component";

describe("ResumoSetorLista", () => {
  it("lista cada cliente com empresa, cnpj formatado e link pra /clientes/[id] com voltarPara pro próprio bucket", () => {
    render(
      <ResumoSetorLista
        clientes={[{ clienteId: "c1", empresa: "Padaria Pão Quente Ltda", cnpj: "11444777000161" }]}
        bucket="sem_documento"
        rotaBase="/clientes/resumo"
      />,
    );

    expect(screen.getByText("Padaria Pão Quente Ltda")).toBeInTheDocument();
    expect(screen.getByText("11.444.777/0001-61")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/clientes/c1?voltarPara=%2Fclientes%2Fresumo%2Fsem_documento",
    );
  });

  it("nos cards de parcelamento, mostra por parcelamento o código, a marca interno e o status do mês", () => {
    render(
      <ResumoSetorLista
        clientes={[
          {
            clienteId: "c1",
            empresa: "Padaria Pão Quente Ltda",
            cnpj: "11444777000161",
            parcelamentos: [
              { codigo: "PARC-1", interno: false, status: "enviado" },
              { codigo: "PARC-2", interno: true, status: "pendente" },
              { codigo: "PARC-3", interno: false, status: "quitado" },
            ],
          },
        ]}
        bucket="parcelamento_pendente"
        rotaBase="/clientes/resumo"
      />,
    );

    const itens = within(screen.getByRole("list", { name: "Parcelamentos" })).getAllByRole(
      "listitem",
    );
    expect(itens.map((li) => li.textContent)).toEqual([
      "PARC-1Enviado no mês",
      "PARC-2InternoPendente no mês",
      "PARC-3Quitado",
    ]);
  });

  it("sem parcelamentos na lista (cards de DAS), não mostra nada além do cliente", () => {
    render(
      <ResumoSetorLista
        clientes={[{ clienteId: "c1", empresa: "Padaria Ltda", cnpj: "11444777000161" }]}
        bucket="das_emitidas"
        rotaBase="/clientes/resumo"
      />,
    );

    expect(screen.queryByText(/no mês/)).not.toBeInTheDocument();
  });

  it("mostra a mensagem própria do card quando a lista está vazia", () => {
    render(
      <ResumoSetorLista
        clientes={[]}
        bucket="parcelamento_pendente_atraso"
        rotaBase="/clientes/resumo"
        vazio="Nenhum cliente em atraso por enquanto."
      />,
    );

    expect(screen.getByText("Nenhum cliente em atraso por enquanto.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum cliente neste status.")).not.toBeInTheDocument();
  });

  it("mostra uma mensagem quando o bucket está vazio", () => {
    render(<ResumoSetorLista clientes={[]} bucket="sem_documento" rotaBase="/clientes/resumo" />);

    expect(screen.getByText("Nenhum cliente neste status.")).toBeInTheDocument();
  });
});
