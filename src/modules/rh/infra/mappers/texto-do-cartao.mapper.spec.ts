import { lerTextoDoCartao } from "@/modules/rh/infra/mappers/texto-do-cartao.mapper";

const l = (texto: string, confianca = 90) => ({ texto, confianca });

describe("lerTextoDoCartao", () => {
  it("lê nome na linha seguinte e as batidas de cada dia, com o terceiro par na coluna Extra", () => {
    const r = lerTextoDoCartao([
      l("N.º Ordem Empregador ou Razão Social"),
      l("Empregado"),
      l("ERICK"),
      l("1 | 08:30 12:30 | 13:30 18:00"),
      l("2 | 08:00 12:00 | 13:00 17:00 | 18:00 20:00"),
      l("Ordem e Limpeza"),
    ]);
    expect(r?.nome).toBe("ERICK");
    expect(r?.dias).toHaveLength(2);
    expect(r?.dias[0].batidas).toEqual([
      { entrada: 510, saida: 750 },
      { entrada: 810, saida: 1080 },
    ]);
    expect(r?.dias[1].extra).toEqual({ entrada: 1080, saida: 1200 });
  });

  it("nome de confiança baixa não é lido (o caso do cartão de exemplo)", () => {
    expect(lerTextoDoCartao([l("Empregado"), l("ERCH", 24), l("1 08:00 12:00")])?.nome).toBeNull();
  });

  it.each([
    ["linha de dia com confiança baixa", [l("Empregado"), l("ERICK"), l("1 08:00 12:00", 50)]],
    ["número ímpar de marcas", [l("Empregado"), l("ERICK"), l("3 08:30")]],
  ])("devolve null: %s", (_, linhas) => {
    expect(lerTextoDoCartao(linhas)).toBeNull();
  });
});
