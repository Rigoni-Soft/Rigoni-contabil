import { DocumentoObrigatorioStatus } from "./documento-obrigatorio-status.vo";

describe("DocumentoObrigatorioStatus", () => {
  it("cria um status válido", () => {
    const resultado = DocumentoObrigatorioStatus.criar("positivo");

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.valor).toBe("positivo");
  });

  it("rejeita um status desconhecido", () => {
    const resultado = DocumentoObrigatorioStatus.criar("inexistente");

    expect(resultado.ok).toBe(false);
  });
});
