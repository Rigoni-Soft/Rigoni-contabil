import { podeTransferir } from "./transferencia.service";

const atendimento = { setor: "recepcao", funcionarioId: "dono" };

describe("podeTransferir", () => {
  it.each([
    [{ id: "x", papel: "admin", setor: "contabil" }, true],
    [{ id: "x", papel: "lider_setor", setor: "recepcao" }, true],
    [{ id: "dono", papel: "funcionario", setor: "recepcao" }, true],
    [{ id: "x", papel: "lider_setor", setor: "contabil" }, false],
    [{ id: "x", papel: "funcionario", setor: "recepcao" }, false],
  ])("%j → %s", (ator, esperado) => {
    expect(podeTransferir(ator, atendimento)).toBe(esperado);
  });

  it("Atendimento sem dono só é transferido por Admin ou Líder", () => {
    const semDono = { setor: "recepcao", funcionarioId: null };
    expect(podeTransferir({ id: "x", papel: "funcionario", setor: "recepcao" }, semDono)).toBe(
      false,
    );
  });
});
