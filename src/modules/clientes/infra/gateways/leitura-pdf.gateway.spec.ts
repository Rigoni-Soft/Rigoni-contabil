import { centavos, dataIso, pega } from "./leitura-pdf.gateway";

describe("leitura-pdf.gateway", () => {
  describe("pega", () => {
    it("devolve o primeiro grupo capturado", () => {
      expect(pega("Parcelamento nº 123456", /nº\s*(\d+)/)).toBe("123456");
    });

    it("devolve undefined sem correspondência", () => {
      expect(pega("nada aqui", /nº\s*(\d+)/)).toBeUndefined();
    });
  });

  describe("centavos", () => {
    it.each([
      ["1.234,56", 123456],
      ["0,05", 5],
      ["10", 1000],
    ])("%s vira %d", (valor, esperado) => {
      expect(centavos(valor)).toBe(esperado);
    });

    it("ausente vira null", () => {
      expect(centavos(undefined)).toBeNull();
      expect(centavos("")).toBeNull();
    });
  });

  describe("dataIso", () => {
    it("converte dd/mm/aaaa em aaaa-mm-dd", () => {
      expect(dataIso("05/10/2026")).toBe("2026-10-05");
    });

    it("ausente vira null", () => {
      expect(dataIso(undefined)).toBeNull();
    });
  });
});
