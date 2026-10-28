import type {
  AtendimentoDoFuncionario,
  AtendimentoRepositoryPort,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AtorSessaoDto } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

import { ListarAtendimentosDaEquipe } from "./listar-atendimentos-da-equipe.use-case";

const linha = (id: string, funcionarioId: string): AtendimentoDoFuncionario => ({
  id,
  funcionarioId,
  funcionarioNome: `Nome ${funcionarioId}`,
  telefone: "5561988887777",
  criadoEm: "2026-10-28T10:00:00Z",
  contato: { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: null },
  ultimaMensagem: null,
});

function montar(ator: AtorSessaoDto | null, falha = false) {
  const setoresLidos: SetorSlug[] = [];
  const repo = {
    emAndamentoDoSetor: async (setor: SetorSlug) => {
      setoresLidos.push(setor);
      return falha
        ? err(new ServicoExternoError("falha"))
        : ok([linha("a1", "lid"), linha("a2", "func-2")]);
    },
  } as unknown as AtendimentoRepositoryPort;
  return {
    caso: new ListarAtendimentosDaEquipe({ usuarioAtual: async () => ator }, repo),
    setoresLidos,
  };
}

const LIDER: AtorSessaoDto = { id: "lid", papel: "lider_setor", setor: "contabil" };
const ADMIN: AtorSessaoDto = { id: "adm", papel: "admin", setor: "administrativo" };

describe("ListarAtendimentosDaEquipe", () => {
  it("Líder vê os Atendimentos dos outros no seu Setor, sem os dele", async () => {
    const { caso, setoresLidos } = montar(LIDER);
    const r = await caso.execute({});
    expect(r.ok && r.value.map((a) => [a.atendimentoId, a.donoNome])).toEqual([
      ["a2", "Nome func-2"],
    ]);
    expect(setoresLidos).toEqual(["contabil"]);
  });

  it("Admin lê o Setor que informa e precisa informar um", async () => {
    const { caso, setoresLidos } = montar(ADMIN);
    expect((await caso.execute({ setor: "rh" })).ok).toBe(true);
    expect(setoresLidos).toEqual(["rh"]);
    const sem = await caso.execute({});
    expect(!sem.ok && sem.error.code).toBe("FORBIDDEN");
  });

  it.each<[string, AtorSessaoDto | null, SetorSlug | undefined]>([
    ["Funcionário do Setor", { id: "f", papel: "funcionario", setor: "contabil" }, "contabil"],
    ["Líder de outro Setor", LIDER, "rh"],
    ["sem sessão", null, undefined],
  ])("%s é recusado e nada é lido", async (_nome, ator, setor) => {
    const { caso, setoresLidos } = montar(ator);
    const r = await caso.execute({ setor });
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    expect(setoresLidos).toEqual([]);
  });

  it("repassa a falha do repositório", async () => {
    const r = await montar(LIDER, true).caso.execute({});
    expect(r.ok).toBe(false);
  });
});
