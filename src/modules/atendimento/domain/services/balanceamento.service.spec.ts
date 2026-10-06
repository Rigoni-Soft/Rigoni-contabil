import { menosCarregado } from "./balanceamento.service";

describe("menosCarregado", () => {
  it("escolhe o livre com menos Atendimentos no mês, ignorando ocupados", () => {
    const f = [
      { id: "a", atendimentosNoMes: 0, livre: false },
      { id: "b", atendimentosNoMes: 3, livre: true },
      { id: "c", atendimentosNoMes: 1, livre: true },
    ];
    expect(menosCarregado(f)?.id).toBe("c");
  });

  it("empate fica com o primeiro; ninguém livre devolve null", () => {
    expect(
      menosCarregado([
        { id: "a", atendimentosNoMes: 1, livre: true },
        { id: "b", atendimentosNoMes: 1, livre: true },
      ])?.id,
    ).toBe("a");
    expect(menosCarregado([{ id: "a", atendimentosNoMes: 0, livre: false }])).toBeNull();
    expect(menosCarregado([])).toBeNull();
  });
});
