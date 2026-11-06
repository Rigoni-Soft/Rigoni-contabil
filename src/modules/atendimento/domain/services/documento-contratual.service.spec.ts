import { descreverDocumento } from "./documento-contratual.service";

describe("descreverDocumento", () => {
  it("contrato social não tem nº nem data; alteração mostra o nº e a data em dd/mm/aaaa", () => {
    expect(descreverDocumento({ numero: null, data: null })).toBe("Contrato social");
    expect(descreverDocumento({ numero: 3, data: "2026-03-01" })).toBe(
      "Alteração nº 3 - 01/03/2026",
    );
  });

  it("decide pelo nº: alteração sem data não vira 'Contrato social' nem 'nº null'", () => {
    expect(descreverDocumento({ numero: 3, data: null })).toBe("Alteração nº 3");
  });
});
