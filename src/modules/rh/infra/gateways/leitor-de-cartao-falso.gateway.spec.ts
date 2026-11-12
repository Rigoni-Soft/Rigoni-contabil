import { validarLeitura } from "@/modules/rh/domain/services/leitura-do-cartao.service";
import { LeitorDeCartaoFalsoGateway } from "@/modules/rh/infra/gateways/leitor-de-cartao-falso.gateway";

describe("LeitorDeCartaoFalsoGateway", () => {
  it("devolve uma leitura que passa na validação do domínio, com falta e abono sinalizados", async () => {
    const r = await new LeitorDeCartaoFalsoGateway().ler();
    expect(r.lido).toBe(true);
    if (!r.lido) return;
    const v = validarLeitura(r.leitura, { competencia: "2026-09", quinzena: 1 });
    expect(v.ok && v.value.faltas).toEqual(["2026-09-03"]);
    expect(v.ok && v.value.dias.filter((d) => d.abono)).toHaveLength(1);
  });
});
