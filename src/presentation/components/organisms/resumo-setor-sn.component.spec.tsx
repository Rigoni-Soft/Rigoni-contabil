import { render, screen } from "@testing-library/react";

import { ResumoSetorSn } from "./resumo-setor-sn.component";

const CARDS = [
  { id: "das_emitidas", titulo: "DAS emitidas", cor: "em_dia", quantidade: 3 },
  { id: "sem_documento", titulo: "Sem documento", cor: "atencao", quantidade: 1 },
  { id: "das_pendente", titulo: "DAS pendente", cor: "urgente", quantidade: 1 },
  { id: "sem_movimento", titulo: "Sem movimento", cor: "informativo", quantidade: 1 },
  { id: "esperando_envio_das", titulo: "Esperando envio DAS", cor: "andamento", quantidade: 1 },
  { id: "com_parcelamento", titulo: "Com parcelamento", cor: "informativo", quantidade: 3 },
  { id: "parcelamento_em_aberto", titulo: "Em aberto", cor: "andamento", quantidade: 2 },
  { id: "parcelamento_pendente", titulo: "Parcelamento pendente", cor: "atencao", quantidade: 1 },
  {
    id: "parcelamento_pendente_atraso",
    titulo: "Pendente em atraso",
    cor: "urgente",
    quantidade: 1,
  },
  { id: "parcelamento_interno", titulo: "Parcelamento interno", cor: "informativo", quantidade: 1 },
  { id: "parcelamento_enviado", titulo: "Parcelamento enviado", cor: "em_dia", quantidade: 1 },
];

describe("ResumoSetorSn", () => {
  it("separa os 11 cards em 'Documentos e DAS' (5) e 'Parcelamento' (6)", () => {
    render(<ResumoSetorSn cards={CARDS} totalClientes={9} busca={<div>busca</div>} />);

    expect(screen.getByText("Documentos e DAS")).toBeInTheDocument();
    expect(screen.getByText("Parcelamento")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(11);
  });

  it("cada card é um link pra /clientes/resumo/<id do bucket>", () => {
    render(<ResumoSetorSn cards={CARDS} totalClientes={9} busca={<div>busca</div>} />);

    const link = screen.getByRole("link", { name: /DAS pendente/ });
    expect(link).toHaveAttribute("href", "/clientes/resumo/das_pendente");
  });

  it("mostra a quantidade de cada card", () => {
    render(<ResumoSetorSn cards={CARDS} totalClientes={9} busca={<div>busca</div>} />);

    expect(screen.getAllByText("3")).toHaveLength(2); // das_emitidas e com_parcelamento
  });

  it("mostra a busca entre o título e os grupos de cards", () => {
    render(<ResumoSetorSn cards={CARDS} totalClientes={9} busca={<div>Buscar cliente</div>} />);

    const secao = screen.getByText("Resumo do setor").closest("section")!;
    const filhos = Array.from(secao.children).map((el) => el.textContent?.slice(0, 20));
    const indiceTitulo = filhos.findIndex((t) => t?.includes("Resumo do setor"));
    const indiceBusca = filhos.findIndex((t) => t?.includes("Buscar cliente"));
    const indiceGrupo = filhos.findIndex((t) => t?.includes("Documentos e DAS"));

    expect(indiceTitulo).toBeLessThan(indiceBusca);
    expect(indiceBusca).toBeLessThan(indiceGrupo);
  });
});
