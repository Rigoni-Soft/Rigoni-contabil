import { FormaEnvio } from "./forma-envio.vo";

describe("FormaEnvio", () => {
  it("cria uma forma de envio válida", () => {
    const resultado = FormaEnvio.criar("whatsapp");

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.valor).toBe("whatsapp");
  });

  it("rejeita uma forma de envio desconhecida", () => {
    const resultado = FormaEnvio.criar("carta");

    expect(resultado.ok).toBe(false);
  });
});
