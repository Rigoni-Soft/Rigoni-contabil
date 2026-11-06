import type { AberturaAtendimento } from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { AbrirAtendimento } from "./abrir-atendimento.use-case";

const abertura: AberturaAtendimento = {
  telefone: "61988887777",
  chave: "61988887777",
  clienteId: "c1",
  setor: "recepcao",
  mensagens: [{ autor: "contato" as const, texto: "oi" }],
};

describe("AbrirAtendimento", () => {
  it("abre na espera do Setor, sem escolher Funcionário", async () => {
    const abertos: AberturaAtendimento[] = [];
    const repo = {
      abrir: async (a: AberturaAtendimento) => {
        abertos.push(a);
        return ok({ id: "at-1" });
      },
    } as unknown as AtendimentoRepositoryPort;

    const r = await new AbrirAtendimento(repo).execute(abertura);

    expect(r).toEqual({ ok: true, value: { id: "at-1" } });
    expect(abertos).toEqual([abertura]);
  });

  it("falha do repositório devolve o erro", async () => {
    const repo = {
      abrir: async () => err(new ServicoExternoError("banco")),
    } as unknown as AtendimentoRepositoryPort;

    expect((await new AbrirAtendimento(repo).execute(abertura)).ok).toBe(false);
  });
});
