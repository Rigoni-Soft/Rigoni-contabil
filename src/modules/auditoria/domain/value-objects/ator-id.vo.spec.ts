import { AtorId } from "./ator-id.vo";

describe("AtorId", () => {
  it("aceita uuid", () => {
    const r = AtorId.criar("11111111-1111-1111-1111-111111111111");
    expect(r.ok && r.value.valor).toBe("11111111-1111-1111-1111-111111111111");
  });

  it.each(["", "admin-1", "joão"])("rejeita %p", (entrada) => {
    expect(AtorId.criar(entrada).ok).toBe(false);
  });
});
