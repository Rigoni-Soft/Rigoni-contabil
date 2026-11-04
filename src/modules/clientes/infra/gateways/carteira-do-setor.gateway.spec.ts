import type { SupabaseClient } from "@supabase/supabase-js";

import { SupabaseCarteiraDoSetorGateway } from "@/modules/clientes/infra/gateways/carteira-do-setor.gateway";
import { TAMANHO_DA_PAGINA } from "@/shared/kernel/paginacao-por-cursor";

// Cliente falso que devolve, a cada `.range()`, uma página nova (ids sempre diferentes), como um
// servidor que nunca esvazia.
function supabaseSemFim() {
  let paginas = 0;
  const consulta = {
    select: () => consulta,
    eq: () => consulta,
    order: () => consulta,
    range: async () => {
      paginas += 1;
      const data = Array.from({ length: TAMANHO_DA_PAGINA }, (_, i) => ({
        id: `${paginas}-${i}`,
        empresa: "Empresa",
        cnpj: "00000000000000",
        cliente_responsaveis: [],
      }));
      return { data, error: null };
    },
  };
  return { cliente: { from: () => consulta } as unknown as SupabaseClient, paginas: () => paginas };
}

describe("SupabaseCarteiraDoSetorGateway", () => {
  it("aborta com erro quando a carteira não termina dentro do teto de páginas", async () => {
    const { cliente, paginas } = supabaseSemFim();

    const resultado = await new SupabaseCarteiraDoSetorGateway(cliente).listar("rh");

    expect(resultado.ok).toBe(false);
    expect(paginas()).toBeLessThanOrEqual(100);
  });
});
