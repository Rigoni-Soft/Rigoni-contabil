import { BearerAutenticacaoJobGateway } from "./bearer-autenticacao-job.gateway";

describe("BearerAutenticacaoJobGateway", () => {
  const gateway = new BearerAutenticacaoJobGateway("segredo");

  it("aceita só o Bearer com o segredo", () => {
    expect(gateway.autorizado("Bearer segredo")).toBe(true);
    expect(gateway.autorizado("Bearer outro")).toBe(false);
    expect(gateway.autorizado("segredo")).toBe(false);
    expect(gateway.autorizado(null)).toBe(false);
  });

  it("sem segredo configurado recusa tudo", () => {
    const sem = new BearerAutenticacaoJobGateway(undefined);
    expect(sem.autorizado("Bearer undefined")).toBe(false);
    expect(sem.autorizado(null)).toBe(false);
  });
});
