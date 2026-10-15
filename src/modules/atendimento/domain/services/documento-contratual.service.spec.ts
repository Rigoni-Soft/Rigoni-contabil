import { descreverDocumento } from "./documento-contratual.service";

describe("descreverDocumento", () => {
  it("contrato social não tem data; alteração mostra a data em dd/mm/aaaa", () => {
    expect(descreverDocumento({ data: null })).toBe("Contrato social");
    expect(descreverDocumento({ data: "2026-03-01" })).toBe("Alteração de 01/03/2026");
  });
});
