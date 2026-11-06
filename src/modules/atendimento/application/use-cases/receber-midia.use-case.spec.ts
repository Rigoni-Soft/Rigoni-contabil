import type { AnexosAtendimentoPort } from "@/modules/atendimento/application/ports/out/anexos-atendimento.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type {
  DownloadMidiaPort,
  MidiaBaixada,
} from "@/modules/atendimento/application/ports/out/download-midia.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { ANEXO_TAMANHO_MAXIMO } from "@/shared/kernel/anexo";
import { err, ok } from "@/shared/kernel/result";

import { ReceberMidia } from "./receber-midia.use-case";

type Opcoes = {
  atendimento?: { atendimentoId: string; jaRegistrada: boolean } | null;
  download?: MidiaBaixada | "transitoria" | "permanente";
  falhaGuardar?: boolean;
  falhaRegistro?: boolean;
  registroDuplicado?: boolean;
  registroEncerrado?: boolean;
};

const AUDIO: MidiaBaixada = {
  bytes: new Uint8Array(2048),
  mime: "audio/ogg; codecs=opus",
};

function montar({
  atendimento = { atendimentoId: "at-1", jaRegistrada: false },
  download = AUDIO,
  falhaGuardar = false,
  falhaRegistro = false,
  registroDuplicado = false,
  registroEncerrado = false,
}: Opcoes = {}) {
  const chamadas = {
    baixou: 0,
    guardados: [] as { atendimentoId: string; nome: string; tipoMime: string }[],
    removidos: [] as string[],
    registradas: [] as unknown[],
    textos: [] as { telefone: string; texto: string }[],
  };
  const repo = {
    atendimentoParaMidia: async () => ok(atendimento),
    registrarMensagemRecebida: async (_: string, mensagem: unknown) => {
      if (falhaRegistro) return err(new ServicoExternoError("banco"));
      chamadas.registradas.push(mensagem);
      if (registroEncerrado) return ok("encerrada" as const);
      return ok(registroDuplicado ? ("duplicada" as const) : ("registrada" as const));
    },
  } as unknown as AtendimentoRepositoryPort;
  const baixador: DownloadMidiaPort = {
    baixar: async () => {
      chamadas.baixou++;
      if (download === "transitoria") return err(new ServicoExternoError("provedor fora"));
      if (download === "permanente") return err(new ValidationError("mídia expirada"));
      return ok(download);
    },
  };
  const anexos = {
    guardar: async ({
      atendimentoId,
      arquivo,
    }: {
      atendimentoId: string;
      arquivo: { nome: string; tipoMime: string };
    }) => {
      if (falhaGuardar) return err(new ServicoExternoError("storage"));
      chamadas.guardados.push({ atendimentoId, nome: arquivo.nome, tipoMime: arquivo.tipoMime });
      return ok(`${atendimentoId}/u/${arquivo.nome}`);
    },
    remover: async (caminho: string) => {
      chamadas.removidos.push(caminho);
      return ok(undefined);
    },
  } as unknown as AnexosAtendimentoPort;
  const envio = {
    enviar: async (m: { telefone: string; texto: string }) => {
      chamadas.textos.push(m);
      return ok(undefined);
    },
  } as unknown as EnvioMensagemPort;
  return { caso: new ReceberMidia(repo, baixador, anexos, envio), chamadas };
}

const entrada = {
  telefone: "5561988887777",
  idDaMensagem: "wamid.1",
  midia: { id: "m-1", mime: "audio/ogg; codecs=opus" },
};

describe("ReceberMidia", () => {
  it("baixa, guarda e registra o áudio como Mensagem do contato, com o MIME sem parâmetros", async () => {
    const { caso, chamadas } = montar();
    expect((await caso.execute(entrada)).ok).toBe(true);
    expect(chamadas.guardados).toEqual([
      { atendimentoId: "at-1", nome: "audio.ogg", tipoMime: "audio/ogg" },
    ]);
    expect(chamadas.registradas).toEqual([
      {
        autor: "contato",
        texto: "",
        idExterno: "wamid.1",
        anexo: {
          tipo: "audio",
          nome: "audio.ogg",
          tamanho: 2048,
          caminho: "at-1/u/audio.ogg",
          miniaturaCaminho: null,
        },
      },
    ]);
  });

  it("documento leva a legenda como texto e o nome que o provedor dá; imagem sem nome ganha um", async () => {
    const pdf = montar({ download: { bytes: new Uint8Array(10), mime: "application/pdf" } });
    await pdf.caso.execute({
      ...entrada,
      midia: { id: "m", mime: "application/pdf", nome: "balanco 2025.pdf" },
      legenda: "segue o balanço",
    });
    expect(pdf.chamadas.registradas[0]).toMatchObject({
      texto: "segue o balanço",
      anexo: { tipo: "documento", nome: "balanco 2025.pdf" },
    });

    const foto = montar({ download: { bytes: new Uint8Array(10), mime: "image/jpeg" } });
    await foto.caso.execute({ ...entrada, midia: { id: "m", mime: "image/jpeg" } });
    expect(foto.chamadas.registradas[0]).toMatchObject({
      anexo: { tipo: "imagem", nome: "imagem.jpg" },
    });
  });

  it("sem Atendimento em andamento (inclui quem está no menu): não baixa, não guarda e a URA só pede texto", async () => {
    const { caso, chamadas } = montar({ atendimento: null });
    expect((await caso.execute(entrada)).ok).toBe(true);
    expect(chamadas.baixou).toBe(0);
    expect(chamadas.guardados).toEqual([]);
    expect(chamadas.registradas).toEqual([]);
    expect(chamadas.textos).toHaveLength(1);
    expect(chamadas.textos[0].telefone).toBe("5561988887777");
    expect(chamadas.textos[0].texto).toContain("mensagens de texto");
  });

  it("reentrega do mesmo evento: não baixa de novo nem duplica a Mensagem", async () => {
    const { caso, chamadas } = montar({
      atendimento: { atendimentoId: "at-1", jaRegistrada: true },
    });
    expect((await caso.execute(entrada)).ok).toBe(true);
    expect(chamadas.baixou).toBe(0);
    expect(chamadas.registradas).toEqual([]);
  });

  it("reentrega paralela já gravada pelo banco: remove o arquivo que sobrou", async () => {
    const { caso, chamadas } = montar({ registroDuplicado: true });
    expect((await caso.execute(entrada)).ok).toBe(true);
    expect(chamadas.removidos).toEqual(["at-1/u/audio.ogg"]);
  });

  it("o fechamento venceu a corrida: o arquivo guardado sai e o cliente é orientado como sem Atendimento", async () => {
    const { caso, chamadas } = montar({ registroEncerrado: true });
    expect((await caso.execute(entrada)).ok).toBe(true);
    expect(chamadas.removidos).toEqual(["at-1/u/audio.ogg"]);
    expect(chamadas.textos[0].texto).toContain("mensagens de texto");
  });

  it("mensagem registrada com sucesso mantém o arquivo na conversa", async () => {
    const { caso, chamadas } = montar();
    expect((await caso.execute(entrada)).ok).toBe(true);
    expect(chamadas.removidos).toEqual([]);
  });

  it("arquivo acima do limite vira aviso do sistema na conversa, sem guardar o arquivo", async () => {
    const grande = { bytes: new Uint8Array(ANEXO_TAMANHO_MAXIMO + 1), mime: "application/pdf" };
    const { caso, chamadas } = montar({ download: grande });
    const r = await caso.execute({ ...entrada, midia: { id: "m", mime: "application/pdf" } });
    expect(r.ok).toBe(true);
    expect(chamadas.guardados).toEqual([]);
    expect(chamadas.registradas).toEqual([
      {
        autor: "ura",
        texto: "O cliente enviou um arquivo que não pôde ser recebido.",
        idExterno: "wamid.1",
      },
    ]);
  });

  it("tipo não aceito (SVG) vira o mesmo aviso do sistema", async () => {
    const { caso, chamadas } = montar({
      download: { bytes: new Uint8Array(5), mime: "image/svg+xml" },
    });
    await caso.execute({ ...entrada, midia: { id: "m", mime: "image/svg+xml" } });
    expect(chamadas.guardados).toEqual([]);
    expect(chamadas.registradas[0]).toMatchObject({ autor: "ura" });
  });

  it("mídia que o provedor não tem mais (falha permanente) também vira o aviso do sistema", async () => {
    const { caso, chamadas } = montar({ download: "permanente" });
    expect((await caso.execute(entrada)).ok).toBe(true);
    expect(chamadas.registradas[0]).toMatchObject({ autor: "ura" });
  });

  it("falha transitória no download devolve erro para o provedor reenviar, sem registrar nada", async () => {
    const { caso, chamadas } = montar({ download: "transitoria" });
    const r = await caso.execute(entrada);
    expect(!r.ok && r.error).toBeInstanceOf(ServicoExternoError);
    expect(chamadas.registradas).toEqual([]);
  });

  it("falha ao guardar o arquivo devolve erro (reenvio) e nada é registrado", async () => {
    const { caso, chamadas } = montar({ falhaGuardar: true });
    expect((await caso.execute(entrada)).ok).toBe(false);
    expect(chamadas.registradas).toEqual([]);
  });

  it("falha ao registrar remove o arquivo guardado e devolve erro", async () => {
    const { caso, chamadas } = montar({ falhaRegistro: true });
    expect((await caso.execute(entrada)).ok).toBe(false);
    expect(chamadas.removidos).toEqual(["at-1/u/audio.ogg"]);
  });

  it("telefone sem dígitos é recusado", async () => {
    const { caso } = montar();
    expect((await caso.execute({ ...entrada, telefone: "abc" })).ok).toBe(false);
  });
});
