import type {
  AtendimentoRepositoryPort,
  ItemDaFila,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AtorSessaoDto } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { ListarFila } from "./listar-fila.use-case";

const AGORA = new Date("2026-10-06T15:00:00Z");
const CONTATO = { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: "11444777000161" };
const ITENS: ItemDaFila[] = [
  {
    id: "at-1",
    filaFuncionarioId: null,
    filaDesde: new Date("2026-10-06T13:54:53Z"),
    telefone: "5561988887777",
    contato: CONTATO,
    resumo: "DAS",
    origem: { setor: "financeiro", nome: "Ana" },
  },
  {
    id: "at-2",
    filaFuncionarioId: "func-1",
    filaDesde: new Date("2026-10-06T14:58:30Z"),
    telefone: "5561977776666",
    contato: { contatoNome: null, empresa: null, cnpj: null },
    resumo: null,
    origem: null,
  },
];

function montar(ator: AtorSessaoDto | null, fila: ItemDaFila[] | "falha" = ITENS) {
  const consultados: string[] = [];
  const repo = {
    filaDoSetor: async (setor: string) => {
      consultados.push(setor);
      return fila === "falha" ? err(new ServicoExternoError("banco")) : ok(fila);
    },
  } as unknown as AtendimentoRepositoryPort;
  const relogio = { agora: () => AGORA };
  return { consultados, caso: new ListarFila({ usuarioAtual: async () => ator }, repo, relogio) };
}

const FUNCIONARIO = { id: "func-1", papel: "funcionario" as const, setor: "contabil" as const };

describe("ListarFila", () => {
  it("lista do mais antigo ao mais novo, com a posição em cada Fila, o que já foi coletado e a espera", async () => {
    const { caso } = montar({ id: "lid", papel: "lider_setor", setor: "contabil" });
    const r = await caso.execute({ setor: "contabil" });
    expect(r).toEqual({
      ok: true,
      value: [
        {
          atendimentoId: "at-1",
          telefone: "5561988887777",
          contato: CONTATO,
          resumo: "DAS",
          origem: { setor: "financeiro", nome: "Ana" },
          filaDesde: ITENS[0].filaDesde,
          espera: "1:05:07",
          filaDoFuncionarioId: null,
          esperaComum: false,
        },
        expect.objectContaining({
          atendimentoId: "at-2",
          espera: "01:30",
          filaDoFuncionarioId: "func-1",
        }),
      ],
    });
  });

  it("só o destinatário vê o Atendimento; sem destinatário, fora da Recepção, só Líder e Admin leem", async () => {
    const ids = async (ator: AtorSessaoDto, setor: "contabil" | "recepcao" = "contabil") => {
      const r = await montar(ator).caso.execute({ setor });
      return r.ok ? r.value.map((i) => i.atendimentoId) : null;
    };

    // at-1 não tem destinatário e at-2 é dirigido a func-1.
    expect(await ids({ id: "func-2", papel: "funcionario", setor: "contabil" })).toEqual([]);
    expect(await ids(FUNCIONARIO)).toEqual(["at-2"]);
    expect(await ids({ id: "lid", papel: "lider_setor", setor: "contabil" })).toEqual([
      "at-1",
      "at-2",
    ]);
    expect(await ids({ id: "adm", papel: "admin", setor: "administrativo" })).toEqual([
      "at-1",
      "at-2",
    ]);
  });

  it("a Recepção tem espera comum: todo Funcionário dela vê o Atendimento sem destinatário, e não o dirigido a outro", async () => {
    const r = await montar({
      id: "rec-1",
      papel: "funcionario",
      setor: "recepcao",
    }).caso.execute({ setor: "recepcao" });

    expect(r.ok && r.value.map((i) => i.atendimentoId)).toEqual(["at-1"]);
  });

  it("Setor vê só a própria Fila; Admin vê a de qualquer Setor", async () => {
    const outro = montar(FUNCIONARIO);
    const r = await outro.caso.execute({ setor: "tributario" });
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    expect(outro.consultados).toEqual([]);

    const admin = montar({ id: "adm", papel: "admin", setor: "administrativo" });
    expect((await admin.caso.execute({ setor: "tributario" })).ok).toBe(true);
    expect(admin.consultados).toEqual(["tributario"]);
  });

  it("a Recepção é um Setor como os outros: o Funcionário dela não vê a espera de outro Setor", async () => {
    const recepcao = { id: "rec-1", papel: "funcionario" as const, setor: "recepcao" as const };
    const outro = montar(recepcao);

    const r = await outro.caso.execute({ setor: "contabil" });

    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    expect(outro.consultados).toEqual([]);
  });

  it("sem sessão nega e falha de leitura devolve o erro", async () => {
    const semSessao = await montar(null).caso.execute({ setor: "contabil" });
    expect(!semSessao.ok && semSessao.error.code).toBe("FORBIDDEN");
    const falha = await montar(FUNCIONARIO, "falha").caso.execute({ setor: "contabil" });
    expect(falha.ok).toBe(false);
  });

  it("sem Setor informado lê a Fila do Setor do próprio usuário", async () => {
    const { caso, consultados } = montar(FUNCIONARIO);

    const r = await caso.execute({});

    expect(r.ok).toBe(true);
    expect(consultados).toEqual(["contabil"]);
  });

  it("Admin precisa informar o Setor (não pertence a um)", async () => {
    const { caso, consultados } = montar({ id: "adm", papel: "admin", setor: "administrativo" });

    const r = await caso.execute({});

    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    expect(consultados).toEqual([]);
  });
});
