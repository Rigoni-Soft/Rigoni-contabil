import type {
  AtendimentoAssumido,
  AtendimentoRepositoryPort,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { MensagemEnviada } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { PromoverDaFila } from "./promover-da-fila.use-case";

const ASSUMIDO: AtendimentoAssumido = {
  id: "at-1",
  telefone: "5561988887777",
  chave: "61988887777",
  funcionarioNome: "Ana",
};

function montar(
  opcoes: {
    assumido?: AtendimentoAssumido | null | "falha";
    envioFalha?: boolean | "excecao";
  } = {},
) {
  const liberados: [string, string][] = [];
  const enviadas: MensagemEnviada[] = [];
  const anexadas: string[] = [];
  const assumido = opcoes.assumido === undefined ? ASSUMIDO : opcoes.assumido;
  const repo = {
    liberarFuncionario: async (funcionarioId: string, setor: string) => {
      liberados.push([funcionarioId, setor]);
      return assumido === "falha" ? err(new ServicoExternoError("banco")) : ok(assumido);
    },
    anexarMensagem: async (_chave: string, m: { texto: string }) => {
      anexadas.push(m.texto);
      return ok({ anexada: true });
    },
  } as unknown as AtendimentoRepositoryPort;
  const caso = new PromoverDaFila(repo, {
    enviar: async (m) => {
      if (opcoes.envioFalha === "excecao") throw new Error("rede");
      if (opcoes.envioFalha) return err(new ServicoExternoError("meta"));
      enviadas.push(m);
      return ok(undefined);
    },
    enviarDocumento: async () => ok(undefined),
  });
  return { caso, liberados, enviadas, anexadas };
}

const INPUT = { funcionarioId: "func-1", setor: "contabil" as const };

describe("PromoverDaFila", () => {
  it("o Funcionário liberado assume o mais antigo e o cliente é avisado de quem vai atender", async () => {
    const { caso, liberados, enviadas, anexadas } = montar();
    const r = await caso.execute(INPUT);
    expect(r).toEqual({ ok: true, value: { atendimentoId: "at-1" } });
    expect(liberados).toEqual([["func-1", "contabil"]]);
    const texto = "Chegou a sua vez! Ana vai te atender agora.";
    expect(enviadas).toEqual([{ telefone: "5561988887777", texto }]);
    expect(anexadas).toEqual([texto]);
  });

  it("Fila vazia ou Funcionário ocupado: nada a fazer e ninguém é avisado", async () => {
    const { caso, enviadas } = montar({ assumido: null });
    expect(await caso.execute(INPUT)).toEqual({ ok: true, value: null });
    expect(enviadas).toEqual([]);
  });

  it("sem nome do atendente o aviso continua válido", async () => {
    const { caso, enviadas } = montar({ assumido: { ...ASSUMIDO, funcionarioNome: null } });
    await caso.execute(INPUT);
    expect(enviadas[0].texto).toBe("Chegou a sua vez! Um atendente vai te atender agora.");
  });

  it("falha do aviso (resultado ou exceção) já com o Atendimento assumido: erro de estado e sem Mensagem", async () => {
    for (const envioFalha of [true, "excecao"] as const) {
      const { caso, anexadas } = montar({ envioFalha });
      const r = await caso.execute(INPUT);
      expect(!r.ok && r.error.code).toBe("INCONSISTENT_STATE");
      expect(anexadas).toEqual([]);
    }
  });

  it("falha do banco ao assumir devolve o erro sem avisar ninguém", async () => {
    const { caso, enviadas } = montar({ assumido: "falha" });
    expect((await caso.execute(INPUT)).ok).toBe(false);
    expect(enviadas).toEqual([]);
  });
});
