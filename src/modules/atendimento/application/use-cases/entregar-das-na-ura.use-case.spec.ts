import type { GuiaDasParaEnvio } from "@/modules/atendimento/application/ports/in/obter-guia-das-para-envio.provider";
import type { ClientesParaLembretePort } from "@/modules/atendimento/application/ports/out/clientes-para-lembrete.provider";
import type {
  DocumentoEnviado,
  EnvioMensagemPort,
  MensagemEnviada,
} from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { GuiaPublicadaPort } from "@/modules/atendimento/application/ports/out/guia-publicada.provider";
import type { ChaveGuia } from "@/modules/atendimento/domain/services/guia-guardada.service";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import type { DasStatusValor } from "@/shared/kernel/das-status";
import { err, ok, type Result } from "@/shared/kernel/result";

import { EntregarDasNaUra } from "./entregar-das-na-ura.use-case";

const CLIENTE = "cliente-1";
const TELEFONE = "5511912345678";
// 20/10/2026 em São Paulo.
const AGORA = new Date("2026-10-20T15:00:00Z");

const GUIA: GuiaDasParaEnvio = {
  competencia: "09/2026",
  vencimento: "20/10/2026",
  guia: { url: "https://storage/das-nova.pdf", nomeArquivo: "das-09-2026.pdf" },
};

function montar(
  opcoes: {
    dasStatus?: DasStatusValor | null;
    cadastro?: boolean;
    dataEnvioDas?: string | null;
    reserva?: string | null;
    guia?: Result<GuiaDasParaEnvio, AppError>;
    guardada?: string | null;
    envioFalha?: boolean;
    concluiu?: boolean;
  } = {},
) {
  const chamadas: string[] = [];
  const mensagens: MensagemEnviada[] = [];
  const documentos: DocumentoEnviado[] = [];
  const conclusoes: { token: string; dataIso: string }[] = [];
  const liberacoes: string[] = [];
  const guiasPedidas: { clienteId: string; mes: string }[] = [];
  const guardadasLidas: ChaveGuia[] = [];

  const clientes: Pick<
    ClientesParaLembretePort,
    "obterDas" | "reservarDas" | "concluirDas" | "liberarDas"
  > = {
    obterDas: async () => {
      chamadas.push("obterDas");
      return ok(
        opcoes.cadastro === false
          ? null
          : {
              dasStatus: opcoes.dasStatus === undefined ? "pronto" : opcoes.dasStatus,
              dataEnvioDas: opcoes.dataEnvioDas ?? null,
            },
      );
    },
    reservarDas: async () => {
      chamadas.push("reservarDas");
      return ok(opcoes.reserva === undefined ? "token-1" : opcoes.reserva);
    },
    concluirDas: async (_clienteId, token, dataIso) => {
      chamadas.push("concluirDas");
      conclusoes.push({ token, dataIso });
      return ok(opcoes.concluiu ?? true);
    },
    liberarDas: async (_clienteId, token) => {
      chamadas.push("liberarDas");
      liberacoes.push(token);
      return ok(undefined);
    },
  };
  const guiaDas = {
    execute: async (clienteId: string, mes: string) => {
      chamadas.push("provedor");
      guiasPedidas.push({ clienteId, mes });
      return opcoes.guia ?? ok(GUIA);
    },
  };
  const descartadas: ChaveGuia[] = [];
  const publicadas: Pick<GuiaPublicadaPort, "reencontrar" | "descartar"> = {
    descartar: async (_clienteId, chave) => {
      descartadas.push(chave);
    },
    reencontrar: async (_clienteId, chave) => {
      chamadas.push("reencontrar");
      guardadasLidas.push(chave);
      return ok(
        opcoes.guardada === undefined ? "https://storage/das-guardada.pdf" : opcoes.guardada,
      );
    },
  };
  const envio = {
    enviar: async (m: MensagemEnviada) => {
      mensagens.push(m);
      return ok(undefined);
    },
    enviarDocumento: async (d: DocumentoEnviado) => {
      chamadas.push("enviarDocumento");
      documentos.push(d);
      return opcoes.envioFalha ? err(new ServicoExternoError("fora do ar")) : ok(undefined);
    },
  } as unknown as EnvioMensagemPort;

  return {
    caso: new EntregarDasNaUra(clientes, guiaDas, publicadas, envio, { agora: () => AGORA }),
    chamadas,
    mensagens,
    documentos,
    conclusoes,
    liberacoes,
    guiasPedidas,
    guardadasLidas,
    descartadas,
  };
}

describe("EntregarDasNaUra", () => {
  describe("DAS que não está pronto", () => {
    it.each<DasStatusValor | null>(["pendente", null])(
      "com status %s avisa que o escritório enviará, sem provedor, reserva nem documento",
      async (dasStatus) => {
        const { caso, chamadas, mensagens } = montar({ dasStatus });

        const r = await caso.execute({ clienteId: CLIENTE, telefone: TELEFONE });

        expect(r.ok).toBe(true);
        expect(mensagens).toHaveLength(1);
        expect(mensagens[0].telefone).toBe(TELEFONE);
        expect(mensagens[0].texto).toContain("escritório");
        expect(chamadas).toEqual(["obterDas"]);
      },
    );

    it("sem cadastro operacional trata como não pronto", async () => {
      const { caso, chamadas, mensagens } = montar({ cadastro: false });

      const r = await caso.execute({ clienteId: CLIENTE, telefone: TELEFONE });

      expect(r.ok).toBe(true);
      expect(mensagens).toHaveLength(1);
      expect(chamadas).toEqual(["obterDas"]);
    });
  });

  describe("DAS pronto e ainda não enviado", () => {
    it("entrega a guia e só depois do aceite grava enviado com a data de hoje", async () => {
      const { caso, chamadas, documentos, conclusoes, guiasPedidas } = montar();

      const r = await caso.execute({ clienteId: CLIENTE, telefone: TELEFONE });

      expect(r.ok).toBe(true);
      expect(documentos).toEqual([
        { telefone: TELEFONE, nomeArquivo: "das-09-2026.pdf", url: "https://storage/das-nova.pdf" },
      ]);
      expect(guiasPedidas).toEqual([{ clienteId: CLIENTE, mes: "2026-10" }]);
      expect(conclusoes).toEqual([{ token: "token-1", dataIso: "2026-10-20" }]);
      expect(chamadas).toEqual([
        "obterDas",
        "reservarDas",
        "provedor",
        "enviarDocumento",
        "concluirDas",
      ]);
    });

    it("com o envio recusado descarta o publicado, libera a reserva, não grava enviado e devolve o erro", async () => {
      const { caso, conclusoes, liberacoes, descartadas } = montar({ envioFalha: true });

      const r = await caso.execute({ clienteId: CLIENTE, telefone: TELEFONE });

      expect(r.ok).toBe(false);
      expect(conclusoes).toEqual([]);
      expect(liberacoes).toEqual(["token-1"]);
      expect(descartadas).toEqual([{ id: "das", periodo: "202610" }]);
    });

    it("com falha do provedor libera a reserva e devolve o erro sem enviar nada", async () => {
      const proibido = new ForbiddenError("sem procuração");
      const { caso, documentos, conclusoes, liberacoes, descartadas } = montar({
        guia: err(proibido),
      });

      const r = await caso.execute({ clienteId: CLIENTE, telefone: TELEFONE });

      expect(r).toEqual(err(proibido));
      expect(documentos).toEqual([]);
      expect(conclusoes).toEqual([]);
      expect(liberacoes).toEqual(["token-1"]);
      expect(descartadas).toEqual([]);
    });

    it("com reserva ocupada por outra tentativa avisa que o envio está em andamento, sem provedor", async () => {
      const { caso, chamadas, mensagens } = montar({ reserva: null });

      const r = await caso.execute({ clienteId: CLIENTE, telefone: TELEFONE });

      expect(r.ok).toBe(true);
      expect(mensagens).toHaveLength(1);
      expect(mensagens[0].texto).toContain("enviando");
      expect(chamadas).toEqual(["obterDas", "reservarDas"]);
    });

    it("se a conclusão não vale (cadastro mudou), a guia já entregue não vira erro, mas deixa rastro", async () => {
      const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
      const { caso } = montar({ concluiu: false });

      const r = await caso.execute({ clienteId: CLIENTE, telefone: TELEFONE });

      expect(r.ok).toBe(true);
      expect(log).toHaveBeenCalledTimes(1);
      log.mockRestore();
    });
  });

  describe("DAS já enviado", () => {
    const enviado = { dasStatus: "enviado", dataEnvioDas: "2026-10-05" } as const;

    it("reenvia a guia guardada do mês do envio, sem provedor, reserva nem nova baixa", async () => {
      const { caso, chamadas, documentos, guardadasLidas } = montar(enviado);

      const r = await caso.execute({ clienteId: CLIENTE, telefone: TELEFONE });

      expect(r.ok).toBe(true);
      expect(guardadasLidas).toEqual([{ id: "das", periodo: "202610" }]);
      expect(documentos).toEqual([
        {
          telefone: TELEFONE,
          nomeArquivo: "das-202610.pdf",
          url: "https://storage/das-guardada.pdf",
        },
      ]);
      expect(chamadas).toEqual(["obterDas", "reencontrar", "enviarDocumento"]);
    });

    it("enviado sem data (dado legado) procura a guia do mês de hoje, e não diz que está indisponível", async () => {
      const { caso, guardadasLidas, mensagens } = montar({ dasStatus: "enviado" });

      const r = await caso.execute({ clienteId: CLIENTE, telefone: TELEFONE });

      expect(r.ok).toBe(true);
      expect(guardadasLidas).toEqual([{ id: "das", periodo: "202610" }]);
      expect(mensagens).toEqual([]);
    });

    it("sem guia guardada devolve erro em vez de chamar o provedor", async () => {
      const { caso, chamadas } = montar({ ...enviado, guardada: null });

      const r = await caso.execute({ clienteId: CLIENTE, telefone: TELEFONE });

      expect(r.ok).toBe(false);
      expect(chamadas).toEqual(["obterDas", "reencontrar"]);
    });
  });
});
