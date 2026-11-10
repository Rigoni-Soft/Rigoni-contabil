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
const relogio = { agora: () => new Date("2026-11-10T12:00:00Z") };

describe("ObterResumoSetorRh", () => {
  it("o Líder vê a carteira toda e o comparativo por Responsável", async () => {
    const r = await new ObterResumoSetorRh(
      sessaoDe("lider_setor", "rh"),
      carteiraFalsa,
      relogio,
    ).execute();

    expect(r.ok && r.value.totalClientes).toBe(4);
    expect(r.ok && r.value.grupos.map((g) => g.titulo)).toEqual(["Parcelamento"]);
    expect(r.ok && r.value.comparativos.responsaveis?.map((f) => [f.rotulo, f.quantidade])).toEqual(
      [
        ["Ana", 2],
        ["Beto", 1],
        ["Sem responsável", 1],
      ],
    );
  });

  it("o grupo Parcelamento tem os 6 cards do SN, zerados enquanto o RH não cadastra parcelamento", async () => {
    const r = await new ObterResumoSetorRh(
      sessaoDe("lider_setor", "rh"),
      carteiraFalsa,
      relogio,
    ).execute();

    expect(r.ok && r.value.grupos[0].cardIds).toEqual([
      "com_parcelamento",
      "parcelamento_em_aberto",
      "parcelamento_pendente",
      "parcelamento_pendente_atraso",
      "parcelamento_interno",
      "parcelamento_enviado",
    ]);
    expect(r.ok && r.value.cards.every((c) => c.quantidade === 0)).toBe(true);
    expect(r.ok && r.value.comparativos.parcelamento.map((f) => [f.id, f.quantidade])).toEqual([
      ["enviado", 0],
      ["pendente", 0],
      ["em_atraso", 0],
      ["interno", 0],
    ]);
  });

  it("o Funcionário vê só os Clientes de que é Responsável, sem os sem atribuição nem o comparativo por Responsável", async () => {
    const r = await new ObterResumoSetorRh(
      sessaoDe("funcionario", "rh", "u2"),
      carteiraFalsa,
      relogio,
    ).execute();

    expect(r.ok && r.value.totalClientes).toBe(1);
    expect(r.ok && r.value.comparativos.responsaveis).toBeUndefined();
  });

  it("o Admin entra para suporte e vê a carteira e o comparativo por Responsável", async () => {
    const r = await new ObterResumoSetorRh(
      sessaoDe("admin", "administrativo"),
      carteiraFalsa,
      relogio,
    ).execute();

    expect(r.ok && r.value.totalClientes).toBe(4);
    expect(r.ok && r.value.comparativos.responsaveis).toHaveLength(3);
  });

  it("recusa quem é de outro Setor e quem não tem sessão", async () => {
    const outro = await new ObterResumoSetorRh(
      sessaoDe("funcionario", "simples_nacional"),
      carteiraFalsa,
      relogio,
    ).execute();
    const anonimo = await new ObterResumoSetorRh(
      { usuarioAtual: async () => null },
      carteiraFalsa,
      relogio,
    ).execute();

    expect(!outro.ok && outro.error.code).toBe("FORBIDDEN");
    expect(!anonimo.ok && anonimo.error.code).toBe("FORBIDDEN");
  });

  it("devolve o erro da consulta", async () => {
    const falha = new ConsultaError("falhou");
    const r = await new ObterResumoSetorRh(
      sessaoDe("lider_setor", "rh"),
      {
        listar: async () => err(falha),
      },
      relogio,
    ).execute();

    expect(!r.ok && r.error).toBe(falha);
  });
});
