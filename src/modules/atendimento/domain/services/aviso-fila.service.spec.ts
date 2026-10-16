import { avisoDeVez } from "./aviso-fila.service";

describe("avisoDeVez", () => {
  it("nomeia o atendente quando se sabe quem é", () => {
    expect(avisoDeVez("Ana")).toBe("Chegou a sua vez! Ana vai te atender agora.");
  });

  it("sem nome continua um aviso válido", () => {
    expect(avisoDeVez(null)).toBe("Chegou a sua vez! Um atendente vai te atender agora.");
  });
});
