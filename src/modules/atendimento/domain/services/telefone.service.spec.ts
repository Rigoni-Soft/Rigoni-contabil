import { semNonoDigito, soDigitosNacionais } from "./telefone.service";

describe("soDigitosNacionais", () => {
  it.each([
    ["5545998480998", "45998480998"], // com DDI e 9º dígito
    ["554598480998", "45998480998"], // WhatsApp sem o 9: devolve o 9 do cadastro
    ["45998480998", "45998480998"],
    ["4598480998", "45998480998"],
    ["(45) 9848-0998", "45998480998"],
    ["554533221100", "4533221100"], // fixo (começa em 2-5) não ganha 9
    ["4533221100", "4533221100"],
  ])("%s vira %s", (entrada, esperado) => {
    expect(soDigitosNacionais(entrada)).toBe(esperado);
  });
});

describe("semNonoDigito", () => {
  it.each([
    ["5545998480998", "554598480998"],
    ["554598480998", "554598480998"], // já sem o 9
    ["554533221100", "554533221100"], // fixo
    ["11912345678", "11912345678"], // sem DDI: fora do formato, segue como veio
  ])("%s vira %s", (entrada, esperado) => {
    expect(semNonoDigito(entrada)).toBe(esperado);
  });
});
