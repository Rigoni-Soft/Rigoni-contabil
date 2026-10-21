import { descreverDocumento, porNumeroDecrescente } from "./documento-contratual.service";

describe("descreverDocumento", () => {
  it("contrato social não tem nº nem data; alteração mostra o nº e a data em dd/mm/aaaa", () => {
    expect(descreverDocumento({ numero: null, data: null })).toBe("Contrato social");
    expect(descreverDocumento({ numero: 3, data: "2026-03-01" })).toBe(
      "Alteração nº 3 - 01/03/2026",
    );
  });
});

describe("porNumeroDecrescente", () => {
  it("contrato (sem nº) primeiro; alterações do maior nº para o menor, mesmo com datas contrárias", () => {
    const docs = [{ numero: 1 }, { numero: null }, { numero: 3 }, { numero: 2 }];
    expect(docs.sort(porNumeroDecrescente).map((d) => d.numero)).toEqual([null, 3, 2, 1]);
  });
});
