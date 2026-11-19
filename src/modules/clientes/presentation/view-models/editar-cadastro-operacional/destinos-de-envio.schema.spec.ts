import { definirDestinoSchema, removerDestinoSchema } from "./destinos-de-envio.schema";

const CLIENTE = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";
const CONTATO = "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2";

describe("definirDestinoSchema", () => {
  it("aceita o contato já cadastrado com tipo e canal", () => {
    const r = definirDestinoSchema.safeParse({
      clienteId: CLIENTE,
      contato: { id: CONTATO },
      tipo: "das",
      canal: "email",
    });

    expect(r.success).toBe(true);
  });

  it("aceita 'todos os envios do Setor' (tipo null) e o contato novo", () => {
    const r = definirDestinoSchema.safeParse({
      clienteId: CLIENTE,
      contato: { novo: { nome: "Dora", telefone: "11999990000", email: "" } },
      tipo: null,
      canal: "whatsapp",
    });

    expect(r.success).toBe(true);
  });

  it.each([
    ["canal fora da lista", { canal: "sms" }],
    ["contato sem id nem dados", { contato: {} }],
    [
      "contato novo sem nome",
      { contato: { novo: { nome: "", telefone: "11999990000", email: "" } } },
    ],
    [
      "contato novo com WhatsApp sem DDD",
      { contato: { novo: { nome: "A", telefone: "99999", email: "" } } },
    ],
  ])("recusa %s", (_nome, parcial) => {
    const r = definirDestinoSchema.safeParse({
      clienteId: CLIENTE,
      contato: { id: CONTATO },
      tipo: null,
      canal: "email",
      ...parcial,
    });

    expect(r.success).toBe(false);
  });
});

describe("removerDestinoSchema", () => {
  it("exige o id do destino", () => {
    expect(removerDestinoSchema.safeParse({ destinoId: CONTATO }).success).toBe(true);
    expect(removerDestinoSchema.safeParse({ destinoId: "x" }).success).toBe(false);
  });
});
