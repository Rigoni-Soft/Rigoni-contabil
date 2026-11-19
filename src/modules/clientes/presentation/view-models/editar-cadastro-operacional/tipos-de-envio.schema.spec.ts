import { definirTiposSchema } from "./tipos-de-envio.schema";

const CLIENTE = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";
const CONTATO = "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2";

describe("definirTiposSchema", () => {
  it("aceita tipos do catálogo, 'todos' e a lista vazia (nenhum envio)", () => {
    expect(
      definirTiposSchema.safeParse({
        clienteId: CLIENTE,
        contatoId: CONTATO,
        tipos: ["das", "todos"],
      }).success,
    ).toBe(true);
    expect(
      definirTiposSchema.safeParse({ clienteId: CLIENTE, contatoId: CONTATO, tipos: [] }).success,
    ).toBe(true);
  });

  it.each([
    ["Cliente que não é UUID", { clienteId: "x" }],
    ["contato que não é UUID", { contatoId: "x" }],
    ["tipo em branco", { tipos: [" "] }],
    ["tipos demais", { tipos: Array.from({ length: 13 }, (_, i) => `t${i}`) }],
  ])("recusa %s", (_nome, parcial) => {
    const r = definirTiposSchema.safeParse({
      clienteId: CLIENTE,
      contatoId: CONTATO,
      tipos: ["das"],
      ...parcial,
    });

    expect(r.success).toBe(false);
  });
});
