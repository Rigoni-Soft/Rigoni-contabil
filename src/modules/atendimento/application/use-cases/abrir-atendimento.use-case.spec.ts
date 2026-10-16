import type { AberturaAtendimento } from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type {
  AtendimentoAssumido,
  AtendimentoRepositoryPort,
  FuncionarioDoSetor,
  NovoAtendimento,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { AbrirAtendimento } from "./abrir-atendimento.use-case";

function montar(
  funcionarios: FuncionarioDoSetor[] | "falha",
  recusasIniciais = 0,
  posicao = 1,
  // Quem o repositório diz que ficou com o Atendimento, se não for o pedido.
  assumidoPeloRepositorio?: string | null,
  // Cliente da Fila que assumiu o Funcionário antes do recém-chegado, e se o aviso a ele falha.
  promovido: AtendimentoAssumido | null = null,
  avisoFalha = false,
) {
  const avisos: { telefone: string; chave: string; texto: string }[] = [];
  const abertos: NovoAtendimento[] = [];
  const tentativas: NovoAtendimento[] = [];
  const repo = {
    funcionariosDoSetor: async () =>
      funcionarios === "falha" ? err(new ServicoExternoError("banco")) : ok(funcionarios),
    abrir: async (a: NovoAtendimento) => {
      tentativas.push(a);
      if (tentativas.length <= recusasIniciais) return ok({ status: "conflito" });
      abertos.push(a);
      return ok({
        status: "aberto",
        id: "at-1",
        funcionarioId:
          assumidoPeloRepositorio === undefined ? a.funcionarioId : assumidoPeloRepositorio,
        promovido,
      });
    },
    anexarMensagem: async () => ok({ anexada: false }),
    posicaoNaFila: async () => ok(posicao),
  } as unknown as AtendimentoRepositoryPort;
  const avisar = {
    execute: async (aviso: { telefone: string; chave: string; texto: string }) => {
      avisos.push(aviso);
      return avisoFalha ? err(new ServicoExternoError("meta")) : ok(undefined);
    },
  };
  return { abertos, tentativas, avisos, caso: new AbrirAtendimento(repo, avisar) };
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
    expect(abertos[0]).toEqual({ ...abertura, funcionarioId: "f2", atribuirLivreSeVazia: false });
  });

  it("vale o Funcionário que o repositório diz ter ficado com o Atendimento (liberado no meio)", async () => {
    const { caso } = montar([{ id: "f1", atendimentosNoMes: 0, livre: false }], 0, 1, "f9");
    const r = await caso.execute(abertura);
    expect(r).toEqual({ ok: true, value: { id: "at-1", funcionarioId: "f9" } });
  });

  it("empate na contagem fica com o primeiro da lista", async () => {
    const { caso } = montar([
      { id: "f1", atendimentosNoMes: 1, livre: true },
      { id: "f2", atendimentosNoMes: 1, livre: true },
    ]);
    const r = await caso.execute(abertura);
    expect(r.ok && r.value.funcionarioId).toBe("f1");
  });

  it("sem Funcionário livre o Atendimento entra na Fila e o cliente recebe a posição", async () => {
    const { abertos, caso } = montar([{ id: "f1", atendimentosNoMes: 0, livre: false }], 0, 4);
    const r = await caso.execute(abertura);
    expect(r).toEqual({ ok: true, value: { id: "at-1", funcionarioId: null, posicao: 4 } });
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

  describe("cliente mais antigo da Fila passa na frente", () => {
    const PROMOVIDO: AtendimentoAssumido = {
      id: "at-0",
      telefone: "5561977776666",
      chave: "61977776666",
      funcionarioNome: "Ana",
    };
    const LIVRE = [{ id: "f1", atendimentosNoMes: 0, livre: true }];

    it("o recém-chegado espera (sem Funcionário, com posição) e o promovido é avisado de quem o atende", async () => {
      const { avisos, caso } = montar(LIVRE, 0, 2, null, PROMOVIDO);

      const r = await caso.execute(abertura);

      expect(r).toEqual({ ok: true, value: { id: "at-1", funcionarioId: null, posicao: 2 } });
      expect(avisos).toEqual([
        {
          telefone: "5561977776666",
          chave: "61977776666",
          texto: "Chegou a sua vez! Ana vai te atender agora.",
        },
      ]);
    });

    it("sem promovido ninguém é avisado", async () => {
      const { avisos, caso } = montar(LIVRE);

      await caso.execute(abertura);

      expect(avisos).toEqual([]);
    });

    it("falha ao avisar o promovido devolve o erro, com o Atendimento já aberto", async () => {
      const { caso } = montar(LIVRE, 0, 2, null, PROMOVIDO, true);

      const r = await caso.execute(abertura);

      expect(!r.ok && r.error.code).toBe("INCONSISTENT_STATE");
    });
  });
});
