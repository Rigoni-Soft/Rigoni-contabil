import { buscarClienteSchema } from "./buscar-cliente.schema";

describe("buscarClienteSchema", () => {
  it("aceita um termo com 3 ou mais caracteres", () => {
    const resultado = buscarClienteSchema.safeParse({ termo: "Pão" });

    expect(resultado.success).toBe(true);
  });

  it("rejeita um termo com menos de 3 caracteres", () => {
    const resultado = buscarClienteSchema.safeParse({ termo: "Pã" });

    expect(resultado.success).toBe(false);
  });

  it("rejeita uma string vazia", () => {
    const resultado = buscarClienteSchema.safeParse({ termo: "" });

    expect(resultado.success).toBe(false);
  });
});
