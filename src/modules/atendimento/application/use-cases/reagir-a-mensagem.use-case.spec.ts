import type {
  AtendimentoEmAndamento,
  AtendimentoRepositoryPort,
  MensagemParaReacao,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AuditoriaPort } from "@/modules/atendimento/application/ports/out/auditoria.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { AtorSessaoDto } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { ReagirAMensagem } from "./reagir-a-mensagem.use-case";

const ATENDIMENTO: AtendimentoEmAndamento = {
  id: "at-1",
  clienteId: "cli-1",
  setor: "contabil",
  funcionarioId: "func-1",
  telefone: "5561988887777",
  chave: "61988887777",
};
const FUNCIONARIO: AtorSessaoDto = { id: "func-1", papel: "funcionario", setor: "contabil" };
const DO_CLIENTE: MensagemParaReacao = { autor: "contato", idExterno: "wamid.1", reacao: null };

function montar({
  ator = FUNCIONARIO as AtorSessaoDto | null,
  mensagem = DO_CLIENTE as MensagemParaReacao | null,
  falhaEnvio = false,
  falhaRegistro = false,
} = {}) {
  const enviadas: unknown[] = [];
  const registradas: unknown[] = [];
  const auditadas: unknown[] = [];
  const repo = {
    buscarEmAndamento: async () => ok(ATENDIMENTO),
    mensagemParaReacao: async () => ok(mensagem),
    registrarReacao: async (...args: unknown[]) => {
      registradas.push(args);
      return falhaRegistro ? err(new ServicoExternoError("banco")) : ok(undefined);
    },
  } as unknown as AtendimentoRepositoryPort;
  const envio = {
    reagir: async (r: unknown) => {
      enviadas.push(r);
      return falhaEnvio ? err(new ServicoExternoError("meta")) : ok(undefined);
    },
  } as unknown as EnvioMensagemPort;
  const auditoria: AuditoriaPort = { registrar: async (a) => void auditadas.push(a) };
  return {
    enviadas,
    registradas,
    auditadas,
    caso: new ReagirAMensagem({ usuarioAtual: async () => ator }, repo, envio, auditoria),
  };
}

const ENTRADA = { atendimentoId: "at-1", mensagemId: "m-1", emoji: "👍" };

describe("ReagirAMensagem", () => {
  it("entrega a reação ao cliente, registra na Mensagem e audita", async () => {
    const { caso, enviadas, registradas, auditadas } = montar();

    const resultado = await caso.execute(ENTRADA);

    expect(resultado.ok).toBe(true);
    expect(enviadas).toEqual([{ telefone: "5561988887777", idExterno: "wamid.1", emoji: "👍" }]);
    expect(registradas).toEqual([["at-1", "m-1", "👍"]]);
    expect(auditadas).toEqual([
      {
        ator: "func-1",
        setor: "contabil",
        acao: "atendimento.reagir_mensagem",
        alvo: "at-1",
        resultado: "sucesso",
      },
    ]);
  });

  it("repetir o emoji remove a reação (emoji vazio ao cliente, null na Mensagem)", async () => {
    const { caso, enviadas, registradas } = montar({ mensagem: { ...DO_CLIENTE, reacao: "👍" } });

    expect((await caso.execute(ENTRADA)).ok).toBe(true);

    expect(enviadas).toEqual([{ telefone: "5561988887777", idExterno: "wamid.1", emoji: "" }]);
    expect(registradas).toEqual([["at-1", "m-1", null]]);
  });

  it("outro emoji troca a reação", async () => {
    const { caso, registradas } = montar({ mensagem: { ...DO_CLIENTE, reacao: "❤️" } });

    await caso.execute(ENTRADA);

    expect(registradas).toEqual([["at-1", "m-1", "👍"]]);
  });

  it("só reage a Mensagem do cliente com id no provedor", async () => {
    const funcionario = montar({ mensagem: { ...DO_CLIENTE, autor: "funcionario" } });
    const semId = montar({ mensagem: { ...DO_CLIENTE, idExterno: null } });
    const inexistente = montar({ mensagem: null });

    const [a, b, c] = await Promise.all([
      funcionario.caso.execute(ENTRADA),
      semId.caso.execute(ENTRADA),
      inexistente.caso.execute(ENTRADA),
    ]);

    expect(!a.ok && a.error.code).toBe("VALIDATION_ERROR");
    expect(!b.ok && b.error.code).toBe("VALIDATION_ERROR");
    expect(!c.ok && c.error.code).toBe("NOT_FOUND");
    expect(funcionario.enviadas).toEqual([]);
  });

  it("recusa emoji vazio ou longo demais, sem sessão e quem não pode agir", async () => {
    const vazio = await montar().caso.execute({ ...ENTRADA, emoji: "  " });
    const longo = await montar().caso.execute({ ...ENTRADA, emoji: "a".repeat(17) });
    const semSessao = await montar({ ator: null }).caso.execute(ENTRADA);
    const outro = await montar({ ator: { ...FUNCIONARIO, id: "func-2" } }).caso.execute(ENTRADA);

    expect(!vazio.ok && vazio.error.code).toBe("VALIDATION_ERROR");
    expect(!longo.ok && longo.error.code).toBe("VALIDATION_ERROR");
    expect(!semSessao.ok && semSessao.error.code).toBe("FORBIDDEN");
    expect(!outro.ok && outro.error.code).toBe("FORBIDDEN");
  });

  it("falha no envio não registra a reação e audita a falha", async () => {
    const { caso, registradas, auditadas } = montar({ falhaEnvio: true });

    const resultado = await caso.execute(ENTRADA);

    expect(resultado.ok).toBe(false);
    expect(registradas).toEqual([]);
    expect(auditadas).toMatchObject([{ resultado: "falha" }]);
  });

  it("reação entregue mas não registrada vira estado inconsistente, auditada como sucesso", async () => {
    const { caso, auditadas } = montar({ falhaRegistro: true });

    const resultado = await caso.execute(ENTRADA);

    expect(!resultado.ok && resultado.error.code).toBe("INCONSISTENT_STATE");
    expect(auditadas).toMatchObject([{ resultado: "sucesso" }]);
  });
});
