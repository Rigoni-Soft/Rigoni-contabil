import {
  chaveDoDocumento,
  rotuloDoBotao,
  rotuloDoDocumento,
  type DocumentoVisivel,
} from "./documentos-contratuais.presenter";

const CONTRATO: DocumentoVisivel = { tipo: "contrato", numero: null, data: null };
const ALTERACAO: DocumentoVisivel = { tipo: "alteracao", numero: 3, data: "2025-03-05" };

describe("documentos contratuais (presenter, #140)", () => {
  it("botão vira 'Visualizar contrato social' quando não há alteração", () => {
    expect(rotuloDoBotao([CONTRATO])).toBe("Visualizar contrato social");
    expect(rotuloDoBotao([ALTERACAO, CONTRATO])).toBe("Visualizar alteração");
  });

  it("rótulo do documento segue a URA: 'Alteração nº N - data' e 'Contrato social'", () => {
    expect(rotuloDoDocumento(ALTERACAO)).toBe("Alteração nº 3 - 05/03/2025");
    expect(rotuloDoDocumento({ ...ALTERACAO, data: null })).toBe("Alteração nº 3");
    expect(rotuloDoDocumento(CONTRATO)).toBe("Contrato social");
  });

  it("chave é estável por documento", () => {
    expect(chaveDoDocumento(ALTERACAO)).toBe("alteracao-3");
    expect(chaveDoDocumento(CONTRATO)).toBe("contrato");
  });
});
