import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";

import {
  chaveDoDocumento,
  documentoEmDestaque,
  paraOpcao,
  rotuloDoBotao,
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
  it("botão vira 'Visualizar contrato social' quando não há alteração", () => {
    expect(rotuloDoBotao([CONTRATO])).toBe("Visualizar contrato social");
    expect(rotuloDoBotao([ALTERACAO, CONTRATO])).toBe("Visualizar alteração");
  });

  it("rótulo do documento segue a URA: 'Alteração nº N - data' e 'Contrato social'", () => {
    expect(rotuloDoDocumento(ALTERACAO)).toBe("Alteração nº 3 - 05/03/2025");
    expect(rotuloDoDocumento({ ...ALTERACAO, data: null })).toBe("Alteração nº 3");
    expect(rotuloDoDocumento(CONTRATO)).toBe("Contrato social");
  });

  it("opção do seletor junta a chave e o rótulo", () => {
    expect(paraOpcao(ALTERACAO)).toEqual({
      valor: "alteracao-3",
      rotulo: "Alteração nº 3 - 05/03/2025",
    });
  });

  it("destaque é a alteração de maior nº, em qualquer ordem da lista", () => {
    const antiga = { ...ALTERACAO, numero: 1, data: "2024-01-10" };

    expect(documentoEmDestaque([CONTRATO, antiga, ALTERACAO])).toBe(ALTERACAO);
    expect(documentoEmDestaque([ALTERACAO, antiga, CONTRATO])).toBe(ALTERACAO);
    expect(documentoEmDestaque([CONTRATO])).toBe(CONTRATO);
  });

  it("chave é estável por documento", () => {
    expect(chaveDoDocumento(ALTERACAO)).toBe("alteracao-3");
    expect(chaveDoDocumento(CONTRATO)).toBe("contrato");
  });
});
