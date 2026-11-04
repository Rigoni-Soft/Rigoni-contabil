import type {
  CarteiraDoSetorQueryPort,
  ClienteDaCarteiraRow,
} from "@/modules/clientes/application/ports/out/carteira-do-setor.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { ConsultaError } from "@/shared/errors/consulta.error";
import { err, ok } from "@/shared/kernel/result";

import { ObterResumoSetorRh } from "./obter-resumo-setor-rh.use-case";

const linha = (n: number, responsavelId: string | null, nome: string | null) => ({
  clienteId: `c${n}`,
  empresa: `Empresa ${n}`,
  cnpj: `${n}`,
  responsavelId,
  responsavelNome: nome,
});

const CARTEIRA: ClienteDaCarteiraRow[] = [
  linha(1, "u1", "Ana"),
  linha(2, "u1", "Ana"),
  linha(3, "u2", "Beto"),
  linha(4, null, null),
];

const sessaoDe = (papel: string, setor: string, id = "u1"): SessaoPort => ({
  usuarioAtual: async () => ({ id, papel, setor }),
});
const carteiraFalsa: CarteiraDoSetorQueryPort = { listar: async () => ok(CARTEIRA) };

describe("ObterResumoSetorRh", () => {
  it("o Líder vê a carteira toda: atribuídos, sem responsável e o comparativo por Responsável", async () => {
    const r = await new ObterResumoSetorRh(sessaoDe("lider_setor", "rh"), carteiraFalsa).execute();

    expect(r.ok && r.value.totalClientes).toBe(4);
    expect(r.ok && r.value.cards.map((c) => [c.id, c.quantidade])).toEqual([
      ["atribuidos", 3],
      ["sem_responsavel", 1],
    ]);
    expect(r.ok && r.value.grupos).toEqual([
      { titulo: "Carteira", cardIds: ["atribuidos", "sem_responsavel"] },
    ]);
    expect(r.ok && r.value.comparativos?.responsaveis.map((f) => [f.rotulo, f.quantidade])).toEqual(
      [
        ["Ana", 2],
        ["Beto", 1],
        ["Sem responsável", 1],
      ],
    );
  });

  it("o Funcionário vê só os Clientes de que é Responsável, sem os sem atribuição nem o comparativo", async () => {
    const r = await new ObterResumoSetorRh(
      sessaoDe("funcionario", "rh", "u2"),
      carteiraFalsa,
    ).execute();

    expect(r.ok && r.value.totalClientes).toBe(1);
    expect(r.ok && r.value.cards.map((c) => [c.id, c.titulo, c.quantidade])).toEqual([
      ["atribuidos", "Meus clientes", 1],
    ]);
    expect(r.ok && r.value.comparativos).toBeUndefined();
  });

  it("o Admin entra para suporte e vê a carteira, sem o comparativo do Líder", async () => {
    const r = await new ObterResumoSetorRh(
      sessaoDe("admin", "administrativo"),
      carteiraFalsa,
    ).execute();

    expect(r.ok && r.value.totalClientes).toBe(4);
    expect(r.ok && r.value.comparativos).toBeUndefined();
  });

  it("recusa quem é de outro Setor e quem não tem sessão", async () => {
    const outro = await new ObterResumoSetorRh(
      sessaoDe("funcionario", "simples_nacional"),
      carteiraFalsa,
    ).execute();
    const anonimo = await new ObterResumoSetorRh(
      { usuarioAtual: async () => null },
      carteiraFalsa,
    ).execute();

    expect(!outro.ok && outro.error.code).toBe("FORBIDDEN");
    expect(!anonimo.ok && anonimo.error.code).toBe("FORBIDDEN");
  });

  it("devolve o erro da consulta", async () => {
    const falha = new ConsultaError("falhou");
    const r = await new ObterResumoSetorRh(sessaoDe("lider_setor", "rh"), {
      listar: async () => err(falha),
    }).execute();

    expect(!r.ok && r.error).toBe(falha);
  });
});
