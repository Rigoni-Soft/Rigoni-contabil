import type {
  AtendimentoEmAndamento,
  AtendimentoRepositoryPort,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AuditoriaPort } from "@/modules/atendimento/application/ports/out/auditoria.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { AtorSessaoDto } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { EnviarMensagemAoCliente } from "./enviar-mensagem-ao-cliente.use-case";

const ATENDIMENTO: AtendimentoEmAndamento = {
  id: "at-1",
  clienteId: "cli-1",
  setor: "contabil",
  funcionarioId: "func-1",
  telefone: "5561988887777",
  chave: "61988887777",
  emAvisoDeInatividade: false,
};
const FUNCIONARIO: AtorSessaoDto = { id: "func-1", papel: "funcionario", setor: "contabil" };

type Opcoes = {
  ator?: AtorSessaoDto | null;
  atendimento?: AtendimentoEmAndamento | null;
  falhaEnvio?: boolean;
  falhaRegistro?: boolean;
  falhaDesfazer?: boolean;
  veredito?: "registrada" | "encerrada" | "sem_autoridade";
};

function montar({
  ator = FUNCIONARIO,
  atendimento = ATENDIMENTO,
  falhaEnvio = false,
  falhaRegistro = false,
  falhaDesfazer = false,
  veredito = "registrada",
}: Opcoes = {}) {
  const enviados: unknown[] = [];
  const registradas: unknown[] = [];
  const desfeitas: unknown[] = [];
  const ordem: string[] = [];
  const auditadas: unknown[] = [];
  const repo = {
    buscarEmAndamento: async () => ok(atendimento),
    registrarMensagemDoFuncionario: async (...args: unknown[]) => {
      ordem.push("registra");
      registradas.push(args);
      if (falhaRegistro) return err(new ServicoExternoError("banco"));
      return ok(veredito === "registrada" ? { status: veredito, id: "m-1" } : { status: veredito });
    },
    desfazerMensagemDoFuncionario: async (id: string) => {
      desfeitas.push(id);
      return falhaDesfazer ? err(new ServicoExternoError("banco")) : ok(undefined);
    },
  } as unknown as AtendimentoRepositoryPort;
  const envio = {
    enviar: async (m: unknown) => {
      ordem.push("envia");
      enviados.push(m);
      return falhaEnvio ? err(new ServicoExternoError("meta")) : ok(undefined);
    },
  } as unknown as EnvioMensagemPort;
  const auditoria: AuditoriaPort = { registrar: async (a) => void auditadas.push(a) };
  return {
    enviados,
    registradas,
    desfeitas,
    ordem,
    auditadas,
    caso: new EnviarMensagemAoCliente({ usuarioAtual: async () => ator }, repo, envio, auditoria),
  };
}

describe("EnviarMensagemAoCliente", () => {
  it("registra a Mensagem de quem escreveu ANTES de enviar o texto ao telefone do Atendimento", async () => {
    const { caso, enviados, registradas, ordem, auditadas } = montar();

    const r = await caso.execute({ atendimentoId: "at-1", texto: "  Bom dia, Maria!  " });

    expect(r.ok).toBe(true);
    expect(enviados).toEqual([{ telefone: "5561988887777", texto: "Bom dia, Maria!" }]);
    expect(registradas).toEqual([["at-1", FUNCIONARIO, "Bom dia, Maria!"]]);
    expect(ordem).toEqual(["registra", "envia"]);
    expect(auditadas).toEqual([
      {
        ator: "func-1",
        setor: "contabil",
        acao: "atendimento.enviar_mensagem",
        alvo: "at-1",
        resultado: "sucesso",
      },
    ]);
  });

  it("recusa texto vazio ou longo demais sem enviar", async () => {
    const { caso, enviados } = montar();

    const vazio = await caso.execute({ atendimentoId: "at-1", texto: "   " });
    const longo = await caso.execute({ atendimentoId: "at-1", texto: "x".repeat(4097) });

    expect(!vazio.ok && vazio.error.code).toBe("VALIDATION_ERROR");
    expect(!longo.ok && longo.error.code).toBe("VALIDATION_ERROR");
    expect(enviados).toEqual([]);
  });

  it("conta o limite por caractere: 4096 emojis passam (8192 unidades UTF-16), 4097 não", async () => {
    const { caso, enviados } = montar();

    const noLimite = await caso.execute({ atendimentoId: "at-1", texto: "😀".repeat(4096) });
    const passou = await caso.execute({ atendimentoId: "at-1", texto: "😀".repeat(4097) });

    expect(noLimite.ok).toBe(true);
    expect(!passou.ok && passou.error.code).toBe("VALIDATION_ERROR");
    expect(enviados).toHaveLength(1);
  });

  it("o Líder do Setor responde em nome do Atendimento; outro Funcionário não", async () => {
    const outro = montar({ ator: { ...FUNCIONARIO, id: "func-2" } });
    const negado = await outro.caso.execute({ atendimentoId: "at-1", texto: "oi" });
    expect(!negado.ok && negado.error.code).toBe("FORBIDDEN");
    expect(outro.enviados).toEqual([]);

    const lider = montar({ ator: { id: "lid", papel: "lider_setor", setor: "contabil" } });
    expect((await lider.caso.execute({ atendimentoId: "at-1", texto: "oi" })).ok).toBe(true);
    expect(lider.registradas).toEqual([
      ["at-1", { id: "lid", papel: "lider_setor", setor: "contabil" }, "oi"],
    ]);
  });

  it("recusa sem sessão e Atendimento que não está em andamento", async () => {
    const semSessao = await montar({ ator: null }).caso.execute({
      atendimentoId: "at-1",
      texto: "oi",
    });
    expect(!semSessao.ok && semSessao.error.code).toBe("FORBIDDEN");

    const inexistente = await montar({ atendimento: null }).caso.execute({
      atendimentoId: "at-1",
      texto: "oi",
    });
    expect(!inexistente.ok && inexistente.error.code).toBe("NOT_FOUND");
  });

  it("falha do envio desfaz a Mensagem que entrou antes e audita a falha", async () => {
    const { caso, desfeitas, auditadas } = montar({ falhaEnvio: true });

    const r = await caso.execute({ atendimentoId: "at-1", texto: "oi" });

    expect(!r.ok && r.error.code).toBe("EXTERNAL_SERVICE_ERROR");
    expect(desfeitas).toEqual(["m-1"]);
    expect(auditadas).toEqual([expect.objectContaining({ resultado: "falha" })]);
  });

  it("falha do envio e da compensação é estado inconsistente (a conversa ainda a registra)", async () => {
    const { caso } = montar({ falhaEnvio: true, falhaDesfazer: true });

    const r = await caso.execute({ atendimentoId: "at-1", texto: "oi" });

    expect(!r.ok && r.error.code).toBe("INCONSISTENT_STATE");
  });

  it("falha ao registrar não envia nada: a Mensagem entra antes de sair", async () => {
    const { caso, enviados } = montar({ falhaRegistro: true });

    const r = await caso.execute({ atendimentoId: "at-1", texto: "oi" });

    expect(r.ok).toBe(false);
    expect(enviados).toEqual([]);
  });

  it("o fechamento venceu a corrida: nada é enviado e o erro diz que o Atendimento acabou", async () => {
    const { caso, enviados, desfeitas } = montar({ veredito: "encerrada" });

    const r = await caso.execute({ atendimentoId: "at-1", texto: "oi" });

    expect(!r.ok && r.error.code).toBe("NOT_FOUND");
    expect(enviados).toEqual([]);
    expect(desfeitas).toEqual([]);
  });

  it("a autoridade mudou entre a conferência e a gravação (transferência/desativação): recusa", async () => {
    const { caso, enviados } = montar({ veredito: "sem_autoridade" });

    const r = await caso.execute({ atendimentoId: "at-1", texto: "oi" });

    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    expect(enviados).toEqual([]);
  });
});
