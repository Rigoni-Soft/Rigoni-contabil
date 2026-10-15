import type { AnexosAtendimentoPort } from "@/modules/atendimento/application/ports/out/anexos-atendimento.provider";
import type {
  AtendimentoEmAndamento,
  AtendimentoRepositoryPort,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AuditoriaPort } from "@/modules/atendimento/application/ports/out/auditoria.provider";
import type { ConversorDeAudioPort } from "@/modules/atendimento/application/ports/out/conversor-de-audio.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { AtorSessaoDto } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ANEXO_TAMANHO_MAXIMO } from "@/shared/kernel/anexo";
import { err, ok } from "@/shared/kernel/result";

import { EnviarAnexoAoCliente } from "./enviar-anexo-ao-cliente.use-case";
import { PrepararAnexoParaEnvio } from "./preparar-anexo-para-envio.use-case";

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
// Primeira página de um ogg com Opus / com Vorbis (o que a conferência de codec lê).
const comCabecalho = (marca: string, tamanho: number) => {
  const bytes = new Uint8Array(tamanho);
  bytes.set(Uint8Array.from(marca, (c) => c.charCodeAt(0)));
  return bytes;
};
const OGG_OPUS = comCabecalho("OggS....OpusHead", 3000);
const OGG_VORBIS = comCabecalho("OggS....vorbis", 3000);
const PDF = { nome: "balanco.pdf", tipoMime: "application/pdf", conteudo: new Uint8Array(2048) };
const FOTO = { nome: "foto.png", tipoMime: "image/png", conteudo: new Uint8Array(10) };

type Opcoes = {
  ator?: AtorSessaoDto | null;
  atendimento?: AtendimentoEmAndamento | null;
  falhaGuardar?: boolean;
  falhaEnvio?: boolean;
  falhaRegistro?: boolean;
  falhaDesfazer?: boolean;
  // Caminhos que outra finalização já reservou, ou que uma Mensagem do histórico já referencia.
  jaReservados?: string[];
  veredito?: "registrada" | "encerrada" | "sem_autoridade";
  falhaConversao?: boolean;
  // Primeiros bytes do objeto subido em partes (por padrão, ogg com Opus).
  cabecalho?: Uint8Array;
  // O que o Storage tem do objeto que o navegador subiu em partes (null: não existe).
  objeto?: { tipoMime: string; tamanho: number } | null;
};

function montar({
  ator = FUNCIONARIO,
  atendimento = ATENDIMENTO,
  falhaGuardar = false,
  falhaEnvio = false,
  falhaRegistro = false,
  falhaDesfazer = false,
  jaReservados = [],
  veredito = "registrada",
  falhaConversao = false,
  cabecalho = OGG_OPUS,
  objeto = null,
}: Opcoes = {}) {
  const conversoes: number[] = [];
  const guardados: unknown[] = [];
  const removidos: string[] = [];
  const enviados: unknown[] = [];
  const registradas: unknown[] = [];
  const desfeitas: unknown[] = [];
  const reservas = new Set<string>(jaReservados);
  const liberadas: string[] = [];
  const auditadas: unknown[] = [];
  const repo = {
    buscarEmAndamento: async () => ok(atendimento),
    registrarMensagemDoFuncionario: async (...args: unknown[]) => {
      registradas.push(args);
      if (falhaRegistro) return err(new ServicoExternoError("banco"));
      return ok(veredito === "registrada" ? { status: veredito, id: "m-1" } : { status: veredito });
    },
    desfazerMensagemDoFuncionario: async (id: string) => {
      desfeitas.push(id);
      return falhaDesfazer ? err(new ServicoExternoError("banco")) : ok(undefined);
    },
  } as unknown as AtendimentoRepositoryPort;
  const anexos: AnexosAtendimentoPort = {
    guardar: async (entrada) => {
      guardados.push(entrada);
      return falhaGuardar
        ? err(new ServicoExternoError("storage"))
        : ok(`at-1/${entrada.arquivo.nome}`);
    },
    linksTemporarios: async (caminhos) =>
      ok(
        Object.fromEntries(
          caminhos.map((c) => [
            c,
            {
              url: `https://link/${c}`,
              urlVisualizacao: `https://link/${c}?ver`,
              expiraEm: "2026-10-14T13:00:00Z",
            },
          ]),
        ),
      ),
    remover: async (caminho) => {
      removidos.push(caminho);
      return ok(undefined);
    },
    reservar: async (caminho) => {
      if (reservas.has(caminho)) return ok(false);
      reservas.add(caminho);
      return ok(true);
    },
    liberarReserva: async (caminho) => {
      liberadas.push(caminho);
      reservas.delete(caminho);
      return ok(undefined);
    },
    inspecionar: async () => ok(objeto),
    cabecalho: async () => ok(cabecalho),
    baixar: async () => ok(new Uint8Array(objeto?.tamanho ?? 0)),
  };
  const envio = {
    enviarAnexo: async (a: unknown) => {
      enviados.push(a);
      return falhaEnvio ? err(new ServicoExternoError("meta")) : ok(undefined);
    },
  } as unknown as EnvioMensagemPort;
  const auditoria: AuditoriaPort = { registrar: async (a) => void auditadas.push(a) };
  const conversor: ConversorDeAudioPort = {
    paraOggOpus: async (conteudo) => {
      conversoes.push(conteudo.byteLength);
      return falhaConversao
        ? err(new ServicoExternoError("sem ffmpeg"))
        : ok(new Uint8Array(conteudo.byteLength / 2));
    },
  };
  return {
    conversoes,
    guardados,
    removidos,
    enviados,
    registradas,
    desfeitas,
    liberadas,
    reservas,
    auditadas,
    caso: new EnviarAnexoAoCliente(
      { usuarioAtual: async () => ator },
      repo,
      anexos,
      envio,
      auditoria,
      new PrepararAnexoParaEnvio(anexos, conversor),
    ),
  };
}

describe("EnviarAnexoAoCliente", () => {
  it("guarda o arquivo, entrega pelo link temporário e registra a Mensagem com a legenda", async () => {
    const { caso, guardados, enviados, registradas, auditadas } = montar();

    const r = await caso.execute({ atendimentoId: "at-1", arquivo: PDF, legenda: "  Segue  " });

    expect(r.ok).toBe(true);
    expect(guardados).toEqual([{ atendimentoId: "at-1", arquivo: PDF }]);
    expect(enviados).toEqual([
      {
        telefone: "5561988887777",
        tipo: "documento",
        url: "https://link/at-1/balanco.pdf",
        nomeArquivo: "balanco.pdf",
        legenda: "Segue",
      },
    ]);
    expect(registradas).toEqual([
      [
        "at-1",
        FUNCIONARIO,
        "Segue",
        {
          tipo: "documento",
          nome: "balanco.pdf",
          tamanho: 2048,
          caminho: "at-1/balanco.pdf",
          miniaturaCaminho: null,
        },
      ],
    ]);
    expect(auditadas).toEqual([
      {
        ator: "func-1",
        setor: "contabil",
        acao: "atendimento.enviar_anexo",
        alvo: "at-1",
        resultado: "sucesso",
      },
    ]);
  });

  it("imagem vai como imagem e a legenda é opcional", async () => {
    const { caso, enviados, registradas } = montar();

    const r = await caso.execute({ atendimentoId: "at-1", arquivo: FOTO });

    expect(r.ok).toBe(true);
    expect(enviados).toEqual([expect.objectContaining({ tipo: "imagem", legenda: undefined })]);
    expect(registradas).toEqual([
      ["at-1", FUNCIONARIO, "", expect.objectContaining({ tipo: "imagem" })],
    ]);
  });

  it.each([
    ["tipo não aceito", { ...PDF, nome: "x.svg", tipoMime: "image/svg+xml" }, undefined],
    ["arquivo vazio", { ...PDF, conteudo: new Uint8Array(0) }, undefined],
    [
      "maior que o limite",
      { ...PDF, conteudo: new Uint8Array(ANEXO_TAMANHO_MAXIMO + 1) },
      undefined,
    ],
    ["legenda longa demais", PDF, "x".repeat(1025)],
  ])("recusa %s sem guardar nem enviar", async (_, arquivo, legenda) => {
    const { caso, guardados, enviados } = montar();

    const r = await caso.execute({ atendimentoId: "at-1", arquivo, legenda });

    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(guardados).toEqual([]);
    expect(enviados).toEqual([]);
  });

  it("aceita exatamente o tamanho máximo", async () => {
    const { caso } = montar();
    const r = await caso.execute({
      atendimentoId: "at-1",
      arquivo: { ...PDF, conteudo: new Uint8Array(ANEXO_TAMANHO_MAXIMO) },
    });
    expect(r.ok).toBe(true);
  });

  it("o Líder do Setor envia; outro Funcionário não", async () => {
    const outro = montar({ ator: { ...FUNCIONARIO, id: "func-2" } });
    const negado = await outro.caso.execute({ atendimentoId: "at-1", arquivo: PDF });
    expect(!negado.ok && negado.error.code).toBe("FORBIDDEN");
    expect(outro.guardados).toEqual([]);

    const lider = montar({ ator: { id: "lid", papel: "lider_setor", setor: "contabil" } });
    expect((await lider.caso.execute({ atendimentoId: "at-1", arquivo: PDF })).ok).toBe(true);
  });

  it("recusa sem sessão e Atendimento que não está em andamento", async () => {
    const semSessao = await montar({ ator: null }).caso.execute({
      atendimentoId: "at-1",
      arquivo: PDF,
    });
    expect(!semSessao.ok && semSessao.error.code).toBe("FORBIDDEN");

    const inexistente = await montar({ atendimento: null }).caso.execute({
      atendimentoId: "at-1",
      arquivo: PDF,
    });
    expect(!inexistente.ok && inexistente.error.code).toBe("NOT_FOUND");
  });

  it("falha do envio remove o arquivo e desfaz a Mensagem que entrou antes", async () => {
    const { caso, removidos, desfeitas, auditadas } = montar({ falhaEnvio: true });

    const r = await caso.execute({ atendimentoId: "at-1", arquivo: PDF });

    expect(r.ok).toBe(false);
    expect(removidos).toEqual(["at-1/balanco.pdf"]);
    expect(desfeitas).toEqual(["m-1"]);
    expect(auditadas).toEqual([expect.objectContaining({ resultado: "falha" })]);
  });

  it("falha do envio e da compensação é estado inconsistente", async () => {
    const { caso } = montar({ falhaEnvio: true, falhaDesfazer: true });

    const r = await caso.execute({ atendimentoId: "at-1", arquivo: PDF });

    expect(!r.ok && r.error.code).toBe("INCONSISTENT_STATE");
  });

  it("fechamento ou perda de autoridade durante a operação: nada é enviado e o arquivo sai", async () => {
    const fechado = montar({ veredito: "encerrada" });
    const a = await fechado.caso.execute({ atendimentoId: "at-1", arquivo: PDF });
    expect(!a.ok && a.error.code).toBe("NOT_FOUND");
    expect(fechado.enviados).toEqual([]);
    expect(fechado.removidos).toEqual(["at-1/balanco.pdf"]);

    const semAutoridade = montar({ veredito: "sem_autoridade" });
    const b = await semAutoridade.caso.execute({ atendimentoId: "at-1", arquivo: PDF });
    expect(!b.ok && b.error.code).toBe("FORBIDDEN");
    expect(semAutoridade.enviados).toEqual([]);
  });

  it("falha ao guardar não envia nem registra", async () => {
    const { caso, enviados, registradas, auditadas } = montar({ falhaGuardar: true });

    const r = await caso.execute({ atendimentoId: "at-1", arquivo: PDF });

    expect(r.ok).toBe(false);
    expect(enviados).toEqual([]);
    expect(registradas).toEqual([]);
    expect(auditadas).toEqual([expect.objectContaining({ resultado: "falha" })]);
  });

  it("falha ao registrar não envia nada e o arquivo guardado sai", async () => {
    const { caso, enviados, removidos, auditadas } = montar({ falhaRegistro: true });

    const r = await caso.execute({ atendimentoId: "at-1", arquivo: PDF });

    expect(r.ok).toBe(false);
    expect(enviados).toEqual([]);
    expect(removidos).toEqual(["at-1/balanco.pdf"]);
    expect(auditadas).toEqual([expect.objectContaining({ resultado: "falha" })]);
  });

  describe("miniatura", () => {
    const MINIATURA = {
      nome: "miniatura.webp",
      tipoMime: "image/webp",
      conteudo: new Uint8Array(500),
    };

    it("imagem com miniatura guarda as duas e registra o caminho da miniatura, sem enviá-la ao cliente", async () => {
      const { caso, guardados, enviados, registradas } = montar();

      const r = await caso.execute({ atendimentoId: "at-1", arquivo: FOTO, miniatura: MINIATURA });

      expect(r.ok).toBe(true);
      expect(guardados).toHaveLength(2);
      expect(enviados).toEqual([expect.objectContaining({ nomeArquivo: "foto.png" })]);
      expect(registradas).toEqual([
        [
          "at-1",
          FUNCIONARIO,
          "",
          expect.objectContaining({
            caminho: "at-1/foto.png",
            miniaturaCaminho: "at-1/miniatura.webp",
          }),
        ],
      ]);
    });

    it.each([
      ["de documento (só imagem tem miniatura)", PDF, MINIATURA],
      ["que não é imagem", FOTO, { ...MINIATURA, tipoMime: "application/pdf" }],
      ["grande demais", FOTO, { ...MINIATURA, conteudo: new Uint8Array(256 * 1024 + 1) }],
      ["vazia", FOTO, { ...MINIATURA, conteudo: new Uint8Array(0) }],
    ])("miniatura %s é ignorada e o envio segue", async (_, arquivo, miniatura) => {
      const { caso, guardados, registradas } = montar();

      const r = await caso.execute({ atendimentoId: "at-1", arquivo, miniatura });

      expect(r.ok).toBe(true);
      expect(guardados).toHaveLength(1);
      expect(registradas).toEqual([
        ["at-1", FUNCIONARIO, "", expect.objectContaining({ miniaturaCaminho: null })],
      ]);
    });

    it("falha do envio remove o original e a miniatura", async () => {
      const { caso, removidos } = montar({ falhaEnvio: true });

      await caso.execute({ atendimentoId: "at-1", arquivo: FOTO, miniatura: MINIATURA });

      expect(removidos.sort()).toEqual(["at-1/foto.png", "at-1/miniatura.webp"]);
    });
  });

  describe("áudio gravado", () => {
    const webm = {
      nome: "gravacao.webm",
      tipoMime: "audio/webm;codecs=opus",
      conteudo: new Uint8Array(4000),
    };
    const ogg = {
      nome: "gravacao.ogg",
      tipoMime: "audio/ogg;codecs=opus",
      conteudo: OGG_OPUS,
    };

    it("webm é convertido para ogg antes de guardar e entregar, e registra o tipo áudio sem legenda", async () => {
      const { caso, conversoes, guardados, enviados, registradas } = montar();

      const r = await caso.execute({ atendimentoId: "at-1", arquivo: webm, legenda: "ignorada" });

      expect(r.ok).toBe(true);
      expect(conversoes).toEqual([4000]);
      expect(guardados).toEqual([
        {
          atendimentoId: "at-1",
          arquivo: { nome: "gravacao.ogg", tipoMime: "audio/ogg", conteudo: new Uint8Array(2000) },
        },
      ]);
      expect(enviados).toEqual([
        {
          telefone: "5561988887777",
          tipo: "audio",
          url: "https://link/at-1/gravacao.ogg",
          nomeArquivo: "gravacao.ogg",
          legenda: undefined,
        },
      ]);
      expect(registradas).toEqual([
        [
          "at-1",
          FUNCIONARIO,
          "",
          {
            tipo: "audio",
            nome: "gravacao.ogg",
            tamanho: 2000,
            caminho: "at-1/gravacao.ogg",
            miniaturaCaminho: null,
          },
        ],
      ]);
    });

    it("ogg com Vorbis é recusado: a Meta só aceita Opus", async () => {
      const { caso, guardados } = montar();

      const r = await caso.execute({
        atendimentoId: "at-1",
        arquivo: { ...ogg, conteudo: OGG_VORBIS },
      });

      expect(r.ok).toBe(false);
      expect(guardados).toEqual([]);
    });

    it("ogg/opus e mp4 seguem sem conversão, com o MIME sem parâmetros", async () => {
      const { caso, conversoes, guardados } = montar();

      expect((await caso.execute({ atendimentoId: "at-1", arquivo: ogg })).ok).toBe(true);
      expect(conversoes).toEqual([]);
      expect(guardados).toEqual([
        { atendimentoId: "at-1", arquivo: { ...ogg, tipoMime: "audio/ogg" } },
      ]);
    });

    it("sem como converter, o envio falha antes de guardar, e a falha é auditada", async () => {
      const { caso, guardados, enviados, auditadas } = montar({ falhaConversao: true });

      const r = await caso.execute({ atendimentoId: "at-1", arquivo: webm });

      expect(r.ok).toBe(false);
      expect(guardados).toEqual([]);
      expect(enviados).toEqual([]);
      expect(auditadas).toMatchObject([{ acao: "atendimento.enviar_anexo", resultado: "falha" }]);
    });

    it.each([
      ["audio/mpeg", 10],
      ["audio/webm", 0],
      ["audio/webm", ANEXO_TAMANHO_MAXIMO + 1],
    ])("recusa %s com %d bytes", async (tipoMime, bytes) => {
      const { caso, conversoes } = montar();

      const r = await caso.execute({
        atendimentoId: "at-1",
        arquivo: { nome: "a", tipoMime, conteudo: new Uint8Array(bytes) },
      });

      expect(r.ok).toBe(false);
      expect(conversoes).toEqual([]);
    });
  });

  describe("arquivo já guardado pelo navegador (upload em partes)", () => {
    const GUARDADO = { caminho: "at-1/u-1/gravacao.ogg", nome: "gravacao.ogg" };

    it("imagem de até 10 MB subida em partes mantém a legenda e a miniatura (R85-04)", async () => {
      const { caso, guardados, enviados, registradas } = montar({
        objeto: { tipoMime: "image/png", tamanho: 9 * 1024 * 1024 },
      });
      const miniatura = {
        nome: "miniatura.webp",
        tipoMime: "image/webp",
        conteudo: new Uint8Array(500),
      };

      const r = await caso.execute({
        atendimentoId: "at-1",
        legenda: " Segue ",
        guardado: { caminho: "at-1/u-1/foto.png", nome: "foto.png" },
        miniatura,
      });

      expect(r.ok).toBe(true);
      expect(guardados).toHaveLength(1);
      expect(enviados).toEqual([
        expect.objectContaining({ nomeArquivo: "foto.png", legenda: "Segue" }),
      ]);
      expect(registradas).toEqual([
        [
          "at-1",
          FUNCIONARIO,
          "Segue",
          expect.objectContaining({
            caminho: "at-1/u-1/foto.png",
            miniaturaCaminho: "at-1/miniatura.webp",
          }),
        ],
      ]);
    });

    describe("posse e consumo do objeto (R85-03)", () => {
      const NO_STORAGE = { tipoMime: "audio/ogg", tamanho: 3000 };

      it("repetir a finalização de um objeto já consumido é recusado SEM remover o arquivo do histórico", async () => {
        const { caso, enviados, removidos, desfeitas } = montar({
          objeto: NO_STORAGE,
          jaReservados: [GUARDADO.caminho],
          falhaEnvio: true,
        });

        const r = await caso.execute({ atendimentoId: "at-1", guardado: GUARDADO });

        expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
        expect(enviados).toEqual([]);
        expect(removidos).toEqual([]);
        expect(desfeitas).toEqual([]);
      });

      it("duas finalizações do mesmo objeto: só uma entrega e a outra é recusada sem tocar no objeto", async () => {
        const primeira = montar({ objeto: NO_STORAGE });
        const ok1 = await primeira.caso.execute({ atendimentoId: "at-1", guardado: GUARDADO });
        expect(ok1.ok).toBe(true);
        expect(primeira.reservas.has(GUARDADO.caminho)).toBe(true);

        // Mesma reserva, estado compartilhado: a segunda vê o objeto já consumido.
        const segunda = montar({ objeto: NO_STORAGE, jaReservados: [...primeira.reservas] });
        const r2 = await segunda.caso.execute({ atendimentoId: "at-1", guardado: GUARDADO });
        expect(r2.ok).toBe(false);
        expect(segunda.enviados).toEqual([]);
        expect(segunda.removidos).toEqual([]);
      });

      it("upload genuinamente novo cuja entrega falha: o objeto sai e a reserva é liberada", async () => {
        const { caso, removidos, liberadas, reservas } = montar({
          objeto: NO_STORAGE,
          falhaEnvio: true,
        });

        const r = await caso.execute({ atendimentoId: "at-1", guardado: GUARDADO });

        expect(r.ok).toBe(false);
        expect(removidos).toEqual([GUARDADO.caminho]);
        expect(liberadas).toEqual([GUARDADO.caminho]);
        expect(reservas.has(GUARDADO.caminho)).toBe(false);
      });

      it("conclusão com sucesso deixa a reserva (o consumo) e não remove nada", async () => {
        const { caso, removidos, liberadas, reservas } = montar({ objeto: NO_STORAGE });

        const r = await caso.execute({ atendimentoId: "at-1", guardado: GUARDADO });

        expect(r.ok).toBe(true);
        expect(removidos).toEqual([]);
        expect(liberadas).toEqual([]);
        expect(reservas.has(GUARDADO.caminho)).toBe(true);
      });

      it("objeto recusado pelo Storage real sai e libera a reserva", async () => {
        const { caso, removidos, liberadas } = montar({
          objeto: { tipoMime: "image/svg+xml", tamanho: 100 },
        });

        const r = await caso.execute({ atendimentoId: "at-1", guardado: GUARDADO });

        expect(r.ok).toBe(false);
        expect(removidos).toEqual([GUARDADO.caminho]);
        expect(liberadas).toEqual([GUARDADO.caminho]);
      });
    });

    it("áudio ogg: confere o objeto no Storage, entrega e registra sem guardar de novo", async () => {
      const { caso, guardados, enviados, registradas, removidos } = montar({
        objeto: { tipoMime: "audio/ogg", tamanho: 3000 },
      });

      const r = await caso.execute({ atendimentoId: "at-1", guardado: GUARDADO });

      expect(r.ok).toBe(true);
      expect(guardados).toEqual([]);
      expect(removidos).toEqual([]);
      expect(enviados).toMatchObject([
        { tipo: "audio", url: "https://link/at-1/u-1/gravacao.ogg" },
      ]);
      expect(registradas).toEqual([
        [
          "at-1",
          FUNCIONARIO,
          "",
          {
            tipo: "audio",
            nome: "gravacao.ogg",
            tamanho: 3000,
            caminho: "at-1/u-1/gravacao.ogg",
            miniaturaCaminho: null,
          },
        ],
      ]);
    });

    it("ogg com Vorbis subido em partes é recusado e removido do Storage", async () => {
      const { caso, removidos, enviados } = montar({
        cabecalho: OGG_VORBIS,
        objeto: { tipoMime: "audio/ogg", tamanho: 3000 },
      });

      const r = await caso.execute({ atendimentoId: "at-1", guardado: GUARDADO });

      expect(r.ok).toBe(false);
      expect(removidos).toEqual([GUARDADO.caminho]);
      expect(enviados).toEqual([]);
    });

    it("webm é baixado, convertido, guardado como ogg e o original sai do Storage", async () => {
      const { caso, conversoes, guardados, removidos, registradas } = montar({
        objeto: { tipoMime: "audio/webm", tamanho: 4000 },
      });

      const r = await caso.execute({
        atendimentoId: "at-1",
        guardado: { caminho: "at-1/u-1/gravacao.webm", nome: "gravacao.webm" },
      });

      expect(r.ok).toBe(true);
      expect(conversoes).toEqual([4000]);
      expect(removidos).toEqual(["at-1/u-1/gravacao.webm"]);
      expect(guardados).toMatchObject([
        { arquivo: { nome: "gravacao.ogg", tipoMime: "audio/ogg" } },
      ]);
      expect(registradas).toMatchObject([
        ["at-1", FUNCIONARIO, "", { tipo: "audio", tamanho: 2000 }],
      ]);
    });

    it("falha na conversão remove o original e não entrega nada", async () => {
      const { caso, removidos, enviados } = montar({
        falhaConversao: true,
        objeto: { tipoMime: "audio/webm", tamanho: 4000 },
      });

      const r = await caso.execute({
        atendimentoId: "at-1",
        guardado: { caminho: "at-1/u-1/gravacao.webm", nome: "gravacao.webm" },
      });

      expect(r.ok).toBe(false);
      expect(removidos).toEqual(["at-1/u-1/gravacao.webm"]);
      expect(enviados).toEqual([]);
    });

    it("objeto de outro Atendimento é recusado sem tocar no Storage", async () => {
      const { caso, removidos, enviados } = montar({
        objeto: { tipoMime: "audio/ogg", tamanho: 10 },
      });

      const r = await caso.execute({
        atendimentoId: "at-1",
        guardado: { caminho: "at-2/u-1/x.ogg", nome: "x.ogg" },
      });

      expect(r.ok).toBe(false);
      expect(removidos).toEqual([]);
      expect(enviados).toEqual([]);
    });

    it("objeto inexistente pede novo envio", async () => {
      const { caso } = montar({ objeto: null });

      const r = await caso.execute({ atendimentoId: "at-1", guardado: GUARDADO });

      expect(r.ok).toBe(false);
    });

    it("tipo ou tamanho fora do aceito pelo Storage real remove o objeto e recusa", async () => {
      const { caso, removidos, enviados } = montar({
        objeto: { tipoMime: "audio/mpeg", tamanho: 100 },
      });

      const r = await caso.execute({ atendimentoId: "at-1", guardado: GUARDADO });

      expect(r.ok).toBe(false);
      expect(removidos).toEqual([GUARDADO.caminho]);
      expect(enviados).toEqual([]);
    });

    it("quem não pode agir no Atendimento é recusado antes de olhar o Storage", async () => {
      const { caso, removidos } = montar({
        ator: { id: "outro", papel: "funcionario", setor: "contabil" },
        objeto: { tipoMime: "audio/ogg", tamanho: 10 },
      });

      const r = await caso.execute({ atendimentoId: "at-1", guardado: GUARDADO });

      expect(r.ok).toBe(false);
      expect(removidos).toEqual([]);
    });
  });
});
