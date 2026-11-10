import type { AcompanhamentoRepository } from "@/modules/rh/application/ports/out/acompanhamento.repository";
import type { RegistrarAcaoAuditoria } from "@/modules/rh/application/ports/out/auditoria.provider";
import { ConflictError } from "@/shared/errors/conflict.error";
import { err, ok } from "@/shared/kernel/result";

import {
  CriarServicoAcompanhamento,
  DesativarServicoAcompanhamento,
  RenomearServicoAcompanhamento,
} from "./gerir-servico-acompanhamento.use-case";

function montar(ator: { papel: string; setor: string } | null, falhaNoRepositorio = false) {
  const chamadas: unknown[][] = [];
  const falhas: RegistrarAcaoAuditoria[] = [];
  const resposta = () => (falhaNoRepositorio ? err(new ConflictError("duplicado")) : ok(undefined));
  const repositorio = {
    criarServico: async (...a: unknown[]) => (chamadas.push(["criar", ...a]), resposta()),
    renomearServico: async (...a: unknown[]) => (chamadas.push(["renomear", ...a]), resposta()),
    desativarServico: async (...a: unknown[]) => (chamadas.push(["desativar", ...a]), resposta()),
  } as unknown as AcompanhamentoRepository;
  const sessao = { usuarioAtual: async () => (ator ? { id: "u1", ...ator } : null) };
  const auditoria = { registrar: async (i: RegistrarAcaoAuditoria) => void falhas.push(i) };
  return {
    criar: new CriarServicoAcompanhamento(sessao, repositorio, auditoria),
    renomear: new RenomearServicoAcompanhamento(sessao, repositorio, auditoria),
    desativar: new DesativarServicoAcompanhamento(sessao, repositorio, auditoria),
    chamadas,
    falhas,
  };
}

const LIDER_RH = { papel: "lider_setor", setor: "rh" };

describe("serviços do acompanhamento", () => {
  it("o Líder do RH cadastra, renomeia e desativa", async () => {
    const { criar, renomear, desativar, chamadas } = montar(LIDER_RH);

    await criar.execute({ nome: "  eSocial " });
    await renomear.execute({ servicoId: "s1", nome: "Folha" });
    await desativar.execute({ servicoId: "s1" });

    expect(chamadas).toEqual([
      ["criar", "eSocial"],
      ["renomear", "s1", "Folha"],
      ["desativar", "s1"],
    ]);
  });

  it.each([
    ["Funcionário do RH", { papel: "funcionario", setor: "rh" }],
    ["Líder de outro setor", { papel: "lider_setor", setor: "simples_nacional" }],
    ["Admin", { papel: "admin", setor: "administrativo" }],
  ])("recusa %s e audita a falha", async (_nome, ator) => {
    const { criar, chamadas, falhas } = montar(ator);

    const r = await criar.execute({ nome: "eSocial" });

    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    expect(chamadas).toEqual([]);
    expect(falhas).toEqual([
      expect.objectContaining({ acao: "rh.servico.criar", resultado: "falha" }),
    ]);
  });

  it("recusa nome vazio ou longo demais", async () => {
    const { criar, renomear, chamadas } = montar(LIDER_RH);

    const vazio = await criar.execute({ nome: "   " });
    const longo = await renomear.execute({ servicoId: "s1", nome: "x".repeat(41) });

    expect(!vazio.ok && vazio.error.code).toBe("VALIDATION_ERROR");
    expect(!longo.ok && longo.error.code).toBe("VALIDATION_ERROR");
    expect(chamadas).toEqual([]);
  });

  it("falha do repositório volta ao chamador e é auditada", async () => {
    const { criar, falhas } = montar(LIDER_RH, true);

    const r = await criar.execute({ nome: "FGTS" });

    expect(r.ok).toBe(false);
    expect(falhas).toHaveLength(1);
  });

  it("sem sessão recusa sem auditar", async () => {
    const { criar, falhas } = montar(null);
    const r = await criar.execute({ nome: "FGTS" });
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    expect(falhas).toEqual([]);
  });
});
