import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";

import {
  alteracaoEmFocoDaUrl,
  documentoEmDestaque,
  rotuloDoDocumento,
} from "./documentos-contratuais.presenter";

const CONTRATO: DocumentoContratualVisivelDto = {
  tipo: "contrato",
  numero: null,
  data: null,
  arquivo: "contrato.pdf",
};
const ALTERACAO: DocumentoContratualVisivelDto = {
  tipo: "alteracao",
  numero: 3,
  data: "2025-03-05",
  arquivo: "3-alteracao.pdf",
};

describe("documentos contratuais (presenter, #140)", () => {
  it("rótulo do documento segue a URA: 'Alteração nº N - data' e 'Contrato social'", () => {
    expect(rotuloDoDocumento(ALTERACAO)).toBe("Alteração nº 3 - 05/03/2025");
    expect(rotuloDoDocumento({ ...ALTERACAO, data: null })).toBe("Alteração nº 3");
    expect(rotuloDoDocumento(CONTRATO)).toBe("Contrato social");
  });

  it("destaque é a alteração de maior nº, em qualquer ordem da lista", () => {
    const antiga = { ...ALTERACAO, numero: 1, data: "2024-01-10" };

    expect(documentoEmDestaque([CONTRATO, antiga, ALTERACAO])).toBe(ALTERACAO);
    expect(documentoEmDestaque([ALTERACAO, antiga, CONTRATO])).toBe(ALTERACAO);
    expect(documentoEmDestaque([CONTRATO])).toBe(CONTRATO);
  });
});

describe("documentoEmDestaque com alteração do aviso (#144)", () => {
  const antiga = { ...ALTERACAO, numero: 1, data: "2024-01-10", arquivo: "1-alteracao.pdf" };
  const LISTA = [ALTERACAO, antiga, CONTRATO];

  it("o nº do aviso escolhe aquela alteração, mesmo havendo uma mais recente", () => {
    expect(documentoEmDestaque(LISTA, 1)).toBe(antiga);
  });

  it("o nº do aviso que é o da mais recente escolhe a própria mais recente", () => {
    expect(documentoEmDestaque(LISTA, 3)).toBe(ALTERACAO);
  });

  it("sem nº, a de maior nº", () => {
    expect(documentoEmDestaque(LISTA, undefined)).toBe(ALTERACAO);
  });

  it("nº que não existe na lista (alteração removida ou parâmetro forjado) cai na mais recente", () => {
    expect(documentoEmDestaque(LISTA, 99)).toBe(ALTERACAO);
  });

  it("o nº nunca escolhe o contrato social, que não tem nº", () => {
    expect(documentoEmDestaque([CONTRATO], 1)).toBe(CONTRATO);
  });
});

describe("alteracaoEmFocoDaUrl (#144)", () => {
  it("aceita só inteiro positivo em texto", () => {
    expect(alteracaoEmFocoDaUrl("2")).toBe(2);
    expect(alteracaoEmFocoDaUrl("15")).toBe(15);
  });

  it("ausente, vazio ou lixo vira undefined (nada de destaque)", () => {
    for (const valor of [
      undefined,
      "",
      " ",
      "0",
      "-1",
      "1.5",
      "2abc",
      "abc",
      "1e3",
      "0x2",
      "NaN",
    ]) {
      expect(alteracaoEmFocoDaUrl(valor)).toBeUndefined();
    }
  });

  it("parâmetro repetido (lista) é ignorado", () => {
    expect(alteracaoEmFocoDaUrl(["1", "2"])).toBeUndefined();
  });
});
