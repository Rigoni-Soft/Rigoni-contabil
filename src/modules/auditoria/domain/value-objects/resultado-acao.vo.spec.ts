import { ResultadoAcao } from "./resultado-acao.vo";

describe("ResultadoAcao", () => {
  it("cria um resultado válido", () => {
    const resultado = ResultadoAcao.criar("sucesso");

    expect(resultado.ok).toBe(true);
  });

  it("rejeita um valor desconhecido", () => {
    const resultado = ResultadoAcao.criar("parcial");

    expect(resultado.ok).toBe(false);
  });

  it("ehSucesso é verdadeiro só para sucesso", () => {
    const sucesso = ResultadoAcao.criar("sucesso");
    const falha = ResultadoAcao.criar("falha");

    expect(sucesso.ok && sucesso.value.ehSucesso()).toBe(true);
    expect(falha.ok && falha.value.ehSucesso()).toBe(false);
  });
});
