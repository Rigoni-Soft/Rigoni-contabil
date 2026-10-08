import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AtorSessaoDto } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { ListarMeusAtendimentos } from "./listar-meus-atendimentos.use-case";

const CONTATO = { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: "11444777000161" };
const ULTIMA = { autor: "contato" as const, texto: "oi", criadoEm: "2026-10-08T12:05:00Z" };
const FUNCIONARIO: AtorSessaoDto = { id: "func-1", papel: "funcionario", setor: "contabil" };

function montar(ator: AtorSessaoDto | null, falha = false) {
  const consultados: string[] = [];
  const repo = {
    emAndamentoDoFuncionario: async (id: string) => {
      consultados.push(id);
      return falha
        ? err(new ServicoExternoError("banco"))
        : ok([
            {
              id: "at-1",
              telefone: "5561988887777",
              criadoEm: "2026-10-08T12:00:00Z",
              contato: CONTATO,
              ultimaMensagem: ULTIMA,
            },
          ]);
    },
  } as unknown as AtendimentoRepositoryPort;
  return {
    consultados,
    caso: new ListarMeusAtendimentos({ usuarioAtual: async () => ator }, repo),
  };
}

describe("ListarMeusAtendimentos", () => {
  it("lista só os Atendimentos em andamento do usuário logado", async () => {
    const { caso, consultados } = montar(FUNCIONARIO);
    const r = await caso.execute();
    expect(r).toEqual({
      ok: true,
      value: [
        {
          atendimentoId: "at-1",
          telefone: "5561988887777",
          criadoEm: "2026-10-08T12:00:00Z",
          contato: CONTATO,
          ultimaMensagem: ULTIMA,
        },
      ],
    });
    expect(consultados).toEqual(["func-1"]);
  });

  it("sem sessão nega e falha de leitura devolve o erro", async () => {
    const semSessao = await montar(null).caso.execute();
    expect(!semSessao.ok && semSessao.error.code).toBe("FORBIDDEN");
    const falha = await montar(FUNCIONARIO, true).caso.execute();
    expect(falha.ok).toBe(false);
  });
});
