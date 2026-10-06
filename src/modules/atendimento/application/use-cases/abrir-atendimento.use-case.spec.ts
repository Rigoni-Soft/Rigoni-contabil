import type { AberturaAtendimento } from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type {
  AtendimentoRepositoryPort,
  FuncionarioDoSetor,
  NovoAtendimento,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { AbrirAtendimento } from "./abrir-atendimento.use-case";

function montar(funcionarios: FuncionarioDoSetor[] | "falha", recusasIniciais = 0) {
  const abertos: NovoAtendimento[] = [];
  const tentativas: NovoAtendimento[] = [];
  const repo = {
    funcionariosDoSetor: async () =>
      funcionarios === "falha" ? err(new ServicoExternoError("banco")) : ok(funcionarios),
    abrir: async (a: NovoAtendimento) => {
      tentativas.push(a);
      if (tentativas.length <= recusasIniciais) return ok({ status: "conflito" });
      abertos.push(a);
      return ok({ status: "aberto", id: "at-1" });
    },
    anexarMensagem: async () => ok({ anexada: false }),
  } as unknown as AtendimentoRepositoryPort;
  return { abertos, tentativas, caso: new AbrirAtendimento(repo) };
}

const abertura: AberturaAtendimento = {
  telefone: "61988887777",
  chave: "61988887777",
  clienteId: "c1",
  setor: "recepcao",
  mensagens: [{ autor: "contato" as const, texto: "oi" }],
};

describe("AbrirAtendimento", () => {
  it("atribui ao Funcionário livre com menos Atendimentos no mês", async () => {
    const { abertos, caso } = montar([
      { id: "f1", atendimentosNoMes: 5, livre: true },
      { id: "f2", atendimentosNoMes: 2, livre: true },
      { id: "f3", atendimentosNoMes: 0, livre: false },
    ]);
    const r = await caso.execute(abertura);
    expect(r).toEqual({ ok: true, value: { id: "at-1", funcionarioId: "f2" } });
    expect(abertos[0]).toEqual({ ...abertura, funcionarioId: "f2" });
  });

  it("empate na contagem fica com o primeiro da lista", async () => {
    const { caso } = montar([
      { id: "f1", atendimentosNoMes: 1, livre: true },
      { id: "f2", atendimentosNoMes: 1, livre: true },
    ]);
    const r = await caso.execute(abertura);
    expect(r.ok && r.value.funcionarioId).toBe("f1");
  });

  it("sem Funcionário livre abre o Atendimento sem atribuição", async () => {
    const { abertos, caso } = montar([{ id: "f1", atendimentosNoMes: 0, livre: false }]);
    const r = await caso.execute(abertura);
    expect(r.ok && r.value.funcionarioId).toBeNull();
    expect(abertos[0].funcionarioId).toBeNull();
  });

  it("falha ao listar Funcionários devolve o erro e não abre nada", async () => {
    const { abertos, caso } = montar("falha");
    expect((await caso.execute(abertura)).ok).toBe(false);
    expect(abertos).toHaveLength(0);
  });

  it("se o escolhido foi ocupado no meio, relista e atribui ao próximo livre", async () => {
    const { abertos, tentativas, caso } = montar(
      [
        { id: "f1", atendimentosNoMes: 0, livre: true },
        { id: "f2", atendimentosNoMes: 1, livre: true },
      ],
      1,
    );
    const r = await caso.execute(abertura);
    expect(tentativas.map((t) => t.funcionarioId)).toEqual(["f1", "f1"]);
    expect(r.ok && r.value.id).toBe("at-1");
    expect(abertos).toHaveLength(1);
  });

  it("recusas em todas as tentativas terminam abrindo sem atribuição", async () => {
    const { abertos, caso } = montar([{ id: "f1", atendimentosNoMes: 0, livre: true }], 3);
    const r = await caso.execute(abertura);
    expect(r.ok && r.value.funcionarioId).toBeNull();
    expect(abertos[0].funcionarioId).toBeNull();
  });
});
