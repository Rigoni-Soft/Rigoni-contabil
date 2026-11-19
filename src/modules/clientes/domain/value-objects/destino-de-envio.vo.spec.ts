import { DestinoDeEnvio } from "./destino-de-envio.vo";

const NOVO = { nome: " Dora ", telefone: "11999990000", email: "DORA@exemplo.com" };

describe("DestinoDeEnvio", () => {
  it("aceita contato já cadastrado com tipo e canal", () => {
    const r = DestinoDeEnvio.criar({ contato: { id: "c-1" }, tipo: "das", canal: "email" });

    expect(r.ok && [r.value.contato, r.value.tipo, r.value.canal]).toEqual([
      { id: "c-1" },
      "das",
      "email",
    ]);
  });

  it("tipo em branco vira 'todos os envios do Setor' (null)", () => {
    const r = DestinoDeEnvio.criar({ contato: { id: "c-1" }, tipo: "  ", canal: "whatsapp" });

    expect(r.ok && r.value.tipo).toBeNull();
  });

  it("recusa contato sem id e canal fora da lista", () => {
    expect(DestinoDeEnvio.criar({ contato: { id: "" }, tipo: null, canal: "whatsapp" }).ok).toBe(
      false,
    );
    expect(DestinoDeEnvio.criar({ contato: { id: "c-1" }, tipo: null, canal: "sms" }).ok).toBe(
      false,
    );
  });

  it("contato novo vem normalizado e com o canal que ele tem", () => {
    const r = DestinoDeEnvio.criar({
      contato: { novo: NOVO },
      tipo: null,
      canal: "whatsapp_e_email",
    });

    expect(r.ok && r.value.contato).toEqual({
      novo: { nome: "Dora", telefone: "11999990000", email: "dora@exemplo.com" },
    });
  });

  it("recusa contato novo inválido ou canal que ele não tem", () => {
    const semNome = DestinoDeEnvio.criar({
      contato: { novo: { ...NOVO, nome: "" } },
      tipo: null,
      canal: "whatsapp",
    });
    const semEmail = DestinoDeEnvio.criar({
      contato: { novo: { nome: "Dora", telefone: "11999990000", email: "" } },
      tipo: null,
      canal: "email",
    });

    expect(semNome.ok).toBe(false);
    expect(semEmail.ok).toBe(false);
  });
});
