import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";

import {
  alteracoesDaLista,
  avisoDeDivergencia,
  erroDeNumeroRepetido,
} from "./anexar-alteracao-contratual.presenter";

const alteracao = (numero: number, data: string): DocumentoContratualVisivelDto => ({
  tipo: "alteracao",
  numero,
  data,
  arquivo: `${numero}-alteracao.pdf`,
});
const CONTRATO: DocumentoContratualVisivelDto = {
  tipo: "contrato",
  numero: null,
  data: null,
  arquivo: "contrato.pdf",
};

describe("alteracoesDaLista", () => {
  it("devolve só as alterações, do maior nº para o menor, mesmo com a lista fora de ordem", () => {
    const lista = [alteracao(1, "2024-01-10"), CONTRATO, alteracao(3, "2025-03-10")];

    expect(alteracoesDaLista(lista)).toEqual([
      { numero: 3, rotulo: "Alteração nº 3 - 10/03/2025", arquivo: "3-alteracao.pdf" },
      { numero: 1, rotulo: "Alteração nº 1 - 10/01/2024", arquivo: "1-alteracao.pdf" },
    ]);
  });
});

describe("erroDeNumeroRepetido", () => {
  it("bloqueia o nº que o Cliente já tem", () => {
    expect(erroDeNumeroRepetido(3, [alteracao(3, "2025-03-10")])).toBe(
      "Já existe a alteração nº 3 deste Cliente.",
    );
  });

  it("libera um nº novo", () => {
    expect(erroDeNumeroRepetido(4, [alteracao(3, "2025-03-10"), CONTRATO])).toBeNull();
  });
});

describe("avisoDeDivergencia", () => {
  const lista = [alteracao(2, "2025-03-10")];

  it("avisa quando a data é anterior à da alteração de nº menor", () => {
    expect(avisoDeDivergencia(3, "2025-01-01", lista)).toBe(
      "Data anterior à da alteração nº 2, confere?",
    );
  });

  it("não avisa quando a ordem do nº e da data bate, ou falta nº ou data", () => {
    expect(avisoDeDivergencia(3, "2025-06-01", lista)).toBeNull();
    expect(avisoDeDivergencia(undefined, "2025-01-01", lista)).toBeNull();
    expect(avisoDeDivergencia(3, "", lista)).toBeNull();
  });
});
