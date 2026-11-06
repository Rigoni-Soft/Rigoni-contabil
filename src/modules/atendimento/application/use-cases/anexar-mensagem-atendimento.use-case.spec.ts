import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { AnexarMensagemAtendimento } from "./anexar-mensagem-atendimento.use-case";

function montar(anexo: "anexada" | "sem_atendimento" | "falha") {
  const repo = {
    anexarMensagem: async () =>
      anexo === "falha"
        ? err(new ServicoExternoError("banco"))
        : ok({ anexada: anexo === "anexada" }),
  } as unknown as AtendimentoRepositoryPort;
  return new AnexarMensagemAtendimento(repo);
}
const mensagem = { autor: "contato" as const, texto: "oi" };

describe("AnexarMensagemAtendimento", () => {
  it("anexada quando havia Atendimento em andamento", async () => {
    expect(await montar("anexada").execute({ chave: "61988887777", mensagem })).toEqual({
      ok: true,
      value: { anexada: true },
    });
  });

  it("não anexada quando o número não tem Atendimento", async () => {
    expect(await montar("sem_atendimento").execute({ chave: "61988887777", mensagem })).toEqual({
      ok: true,
      value: { anexada: false },
    });
  });

  it("propaga a falha do repositório", async () => {
    expect((await montar("falha").execute({ chave: "61988887777", mensagem })).ok).toBe(false);
  });
});
