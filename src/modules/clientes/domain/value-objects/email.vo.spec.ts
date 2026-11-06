import { Email } from "./email.vo";

describe("Email", () => {
  it("guarda o e-mail sem espaços nas pontas", () => {
    const email = Email.criar("  financeiro@padaria.com.br ");
    expect(email.ok && email.value.valor).toBe("financeiro@padaria.com.br");
  });

  it("aceita e-mail com a letra s", () => {
    expect(Email.criar("contato@silva.com.br").ok).toBe(true);
  });

  it.each(["sem-arroba", "con tato@silva.com.br", "@semlocal.com", "sem@", ""])(
    "rejeita %p",
    (entrada) => {
      expect(Email.criar(entrada).ok).toBe(false);
    },
  );

  it("rejeita acima de 254 caracteres, o limite da coluna", () => {
    expect(Email.criar(`${"a".repeat(250)}@b.co`).ok).toBe(false);
  });
});
