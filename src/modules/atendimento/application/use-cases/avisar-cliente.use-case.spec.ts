import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { MensagemEnviada } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { AvisarCliente } from "./avisar-cliente.use-case";

function montar(opcoes: { envioFalha?: boolean | "excecao"; registroFalha?: boolean } = {}) {
  const enviadas: MensagemEnviada[] = [];
  const anexadas: [string, string][] = [];
  const repo = {
    anexarMensagem: async (chave: string, m: { autor: string; texto: string }) => {
      if (opcoes.registroFalha) return err(new ServicoExternoError("banco"));
      anexadas.push([chave, `${m.autor}:${m.texto}`]);
      return ok({ anexada: true });
    },
  } as unknown as AtendimentoRepositoryPort;
  const caso = new AvisarCliente(
    {
      enviar: async (m) => {
        if (opcoes.envioFalha === "excecao") throw new Error("rede");
        if (opcoes.envioFalha) return err(new ServicoExternoError("meta"));
        enviadas.push(m);
        return ok(undefined);
      },
      enviarDocumento: async () => ok(undefined),
    },
    repo,
  );
  return { caso, enviadas, anexadas };
}

const INPUT = { telefone: "5561988887777", chave: "61988887777", texto: "oi" };

describe("AvisarCliente", () => {
  it("envia e guarda como Mensagem da URA", async () => {
    const { caso, enviadas, anexadas } = montar();
    expect(await caso.execute(INPUT)).toEqual({ ok: true, value: undefined });
    expect(enviadas).toEqual([{ telefone: "5561988887777", texto: "oi" }]);
    expect(anexadas).toEqual([["61988887777", "ura:oi"]]);
  });

  it("envio que falha (resultado ou exceção) não vira Mensagem", async () => {
    for (const envioFalha of [true, "excecao"] as const) {
      const { caso, anexadas } = montar({ envioFalha });
      expect((await caso.execute(INPUT)).ok).toBe(false);
      expect(anexadas).toEqual([]);
    }
  });

  it("falha ao guardar a Mensagem devolve o erro", async () => {
    expect((await montar({ registroFalha: true }).caso.execute(INPUT)).ok).toBe(false);
  });
});
