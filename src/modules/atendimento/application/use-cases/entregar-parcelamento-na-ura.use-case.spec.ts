import type {
  DocumentoEnviado,
  MensagemEnviada,
} from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { GuiaFiscal } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type {
  EnvioRegistrado,
  GuiaEntregue,
  ParcelamentoDoCliente,
} from "@/modules/atendimento/application/ports/out/parcelamentos-do-cliente.provider";
import type { ChaveGuia } from "@/modules/atendimento/domain/services/guia-guardada.service";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { EntregarParcelamentoNaUra } from "./entregar-parcelamento-na-ura.use-case";

const TELEFONE = "5511912345678";
// 20/10/2026 em São Paulo: mês corrente 202610, anterior 202609.
const AGORA = new Date("2026-10-20T15:00:00Z");

const guia = (parcela: string, valorCentavos = 10_000): GuiaFiscal => ({
  nomeArquivo: `${parcela}.pdf`,
  pdfBase64: "JVBERi0=",
  parcela,
  valorCentavos,
});

const parcelamento = (
  id: string,
  extra: Partial<ParcelamentoDoCliente> = {},
): ParcelamentoDoCliente => ({
  id,
  codigo: `COD-${id}`,
  interno: false,
  valorParcelaCentavos: 10_000,
  parcelasRestantes: 5,
  parcelasEnviadas: [],
  ...extra,
});

function montar(
  emAberto: ParcelamentoDoCliente[],
  opcoes: {
    comuns?: number;
    guias?: Result<GuiaFiscal[], AppError>;
    semCaminho?: boolean;
    entreguesFalha?: boolean;
    publicarFalha?: boolean;
    documentoFalha?: boolean;
    registro?: EnvioRegistrado;
  } = {},
) {
  const mensagens: MensagemEnviada[] = [];
  const documentos: DocumentoEnviado[] = [];
  const registrados: [string, string, string, string][] = [];
  const reencontradas: string[] = [];
  const publicadas: ChaveGuia[] = [];
  let buscas = 0;
  // O envio já registrado de cada parcela guarda o caminho do PDF que foi entregue.
  const entregues: GuiaEntregue[] = emAberto.flatMap((p) =>
    p.parcelasEnviadas.map((parcela) => ({
      parcelamentoId: p.id,
      parcela,
      identidade: `${parcela}:10000`,
      caminho: opcoes.semCaminho ? null : `c1/${p.id}/${parcela}-entregue.pdf`,
    })),
  );
  const caso = new EntregarParcelamentoNaUra(
    {
      listarEmAberto: async () => ok(emAberto),
      contarComuns: async () => ok(opcoes.comuns ?? emAberto.filter((p) => !p.interno).length),
      guiasEntregues: async () =>
        opcoes.entreguesFalha ? err(new ServicoExternoError("banco")) : ok(entregues),
      registrarEnvio: async (id, parcela, identidade, caminho) => {
        registrados.push([id, parcela, identidade, caminho]);
        return ok(opcoes.registro ?? "registrado");
      },
    },
    {
      buscarGuiasParcelamento: async () => {
        buscas += 1;
        return opcoes.guias ?? ok([guia("202610")]);
      },
    },
    {
      publicar: async (_cliente, { nomeArquivo }, chave) => {
        publicadas.push(chave);
        if (opcoes.publicarFalha) return err(new ServicoExternoError("storage"));
        return ok({
          url: `https://storage/${nomeArquivo}`,
          caminho: `c1/${chave.id}/${chave.periodo}-novo.pdf`,
        });
      },
      reencontrar: async (caminho) => {
        reencontradas.push(caminho);
        return ok(`https://storage/${caminho}`);
      },
    },
    {
      enviar: async (m) => {
        mensagens.push(m);
        return ok(undefined);
      },
      enviarDocumento: async (d) => {
        if (opcoes.documentoFalha) return err(new ServicoExternoError("whatsapp"));
        documentos.push(d);
        return ok(undefined);
      },
      enviarTemplate: async () => ok(undefined),
      enviarAnexo: async () => ok(undefined),
      reagir: async () => ok(undefined),
    },
    { agora: () => AGORA },
  );
  const executar = () => caso.execute({ clienteId: "c1", telefone: TELEFONE });
  return {
    executar,
    mensagens,
    documentos,
    registrados,
    reencontradas,
    publicadas,
    buscas: () => buscas,
  };
}

describe("EntregarParcelamentoNaUra (#128)", () => {
  it("nenhum parcelamento comum cadastrado: avisa sem chamar o provedor", async () => {
    const { executar, mensagens, buscas } = montar([]);
    expect((await executar()).ok).toBe(true);
    expect(mensagens[0].texto).toContain("parcelamento vigente");
    expect(buscas()).toBe(0);
  });

  it("só internos: responde como se não houvesse parcelamento, sem mencioná-los", async () => {
    const { executar, mensagens, documentos, buscas } = montar([
      parcelamento("1", { interno: true }),
    ]);
    expect((await executar()).ok).toBe(true);
    expect(mensagens).toHaveLength(1);
    expect(mensagens[0].texto).toContain("parcelamento vigente");
    expect(mensagens[0].texto).not.toMatch(/intern/i);
    expect(documentos).toHaveLength(0);
    expect(buscas()).toBe(0);
  });

  it("todos os comuns quitados: avisa sem chamar o provedor", async () => {
    const { executar, mensagens, buscas } = montar([], { comuns: 2 });
    expect((await executar()).ok).toBe(true);
    expect(mensagens[0].texto).toContain("quitados");
    expect(buscas()).toBe(0);
  });

  it("primeira entrega da parcela do mês: envia o PDF identificado pelo código, registra e desconta", async () => {
    const { executar, documentos, registrados, publicadas, mensagens } = montar([
      parcelamento("1"),
    ]);
    expect((await executar()).ok).toBe(true);
    expect(documentos).toEqual([
      {
        telefone: TELEFONE,
        nomeArquivo: "parcelamento-COD-1-202610.pdf",
        url: "https://storage/202610.pdf",
      },
    ]);
    expect(publicadas).toEqual([{ id: "1", periodo: "202610" }]);
    expect(registrados).toEqual([["1", "202610", "202610:10000", "c1/1/202610-novo.pdf"]]);
    expect(mensagens).toHaveLength(0);
  });

  it("provedor sem a parcela do mês (fora do período): entrega a do mês anterior e a registra", async () => {
    const { executar, documentos, registrados } = montar([parcelamento("1")], {
      guias: ok([guia("202609")]),
    });
    expect((await executar()).ok).toBe(true);
    expect(documentos[0].nomeArquivo).toBe("parcelamento-COD-1-202609.pdf");
    expect(registrados).toEqual([["1", "202609", "202609:10000", "c1/1/202609-novo.pdf"]]);
  });

  it("envia a guia do comum e ignora o interno, cuja guia também o comum comporta", async () => {
    const { executar, documentos, registrados, mensagens } = montar(
      [
        parcelamento("1", { valorParcelaCentavos: 10_000 }),
        parcelamento("3", { interno: true, valorParcelaCentavos: 30_000 }),
      ],
      { guias: ok([guia("202610", 10_000), guia("202610", 30_000)]) },
    );
    expect((await executar()).ok).toBe(true);
    expect(documentos.map((d) => d.nomeArquivo)).toEqual(["parcelamento-COD-1-202610.pdf"]);
    expect(registrados).toEqual([["1", "202610", "202610:10000", "c1/1/202610-novo.pdf"]]);
    expect(mensagens).toHaveLength(0);
  });

  it("parcela do mês já registrada: reenvia o PDF guardado, sem provedor e sem novo desconto", async () => {
    const { executar, documentos, registrados, reencontradas, buscas } = montar([
      parcelamento("1", { parcelasEnviadas: ["202610"] }),
    ]);
    expect((await executar()).ok).toBe(true);
    expect(reencontradas).toEqual(["c1/1/202610-entregue.pdf"]);
    expect(documentos).toEqual([
      {
        telefone: TELEFONE,
        nomeArquivo: "parcelamento-COD-1-202610.pdf",
        url: "https://storage/c1/1/202610-entregue.pdf",
      },
    ]);
    expect(registrados).toHaveLength(0);
    expect(buscas()).toBe(0);
  });

  it("falha de um parcelamento não impede os outros e a resposta lista os que falharam", async () => {
    const { executar, documentos, mensagens } = montar(
      [
        parcelamento("1", { parcelasEnviadas: ["202610"], valorParcelaCentavos: 20_000 }),
        parcelamento("2", { valorParcelaCentavos: 10_000 }),
      ],
      { semCaminho: true, guias: ok([guia("202609", 10_000)]) },
    );
    expect((await executar()).ok).toBe(true);
    expect(documentos.map((d) => d.nomeArquivo)).toEqual(["parcelamento-COD-2-202609.pdf"]);
    expect(mensagens).toHaveLength(1);
    expect(mensagens[0].texto).toContain("COD-1");
    expect(mensagens[0].texto).not.toContain("COD-2");
  });

  it("guia que não saiu não é registrada nem descontada", async () => {
    const { executar, registrados, mensagens, documentos } = montar([parcelamento("1")], {
      publicarFalha: true,
    });
    expect((await executar()).ok).toBe(true);
    expect(documentos).toHaveLength(0);
    expect(registrados).toHaveLength(0);
    expect(mensagens[0].texto).toContain("COD-1");
  });

  it("parcelamento sem guia do mês nem do anterior entra na lista de falhas", async () => {
    const { executar, documentos, mensagens } = montar([parcelamento("1")], { guias: ok([]) });
    expect((await executar()).ok).toBe(true);
    expect(documentos).toHaveLength(0);
    expect(mensagens[0].texto).toContain("COD-1");
  });

  it("provedor devolve a parcela do mês e a do mês anterior: entrega só a do mês", async () => {
    const { executar, documentos, registrados } = montar([parcelamento("1")], {
      guias: ok([guia("202609"), guia("202610")]),
    });
    expect((await executar()).ok).toBe(true);
    expect(documentos.map((d) => d.nomeArquivo)).toEqual(["parcelamento-COD-1-202610.pdf"]);
    expect(registrados).toEqual([["1", "202610", "202610:10000", "c1/1/202610-novo.pdf"]]);
  });

  it("mês anterior já registrado e provedor sem a do mês: reenvia o PDF guardado do anterior", async () => {
    const { executar, documentos, registrados, reencontradas, buscas } = montar(
      [parcelamento("1", { parcelasEnviadas: ["202609"] })],
      { guias: ok([]) },
    );
    expect((await executar()).ok).toBe(true);
    // O provedor é consultado pela parcela do mês, que ainda não tem registro.
    expect(buscas()).toBe(1);
    expect(reencontradas).toEqual(["c1/1/202609-entregue.pdf"]);
    expect(documentos.map((d) => d.nomeArquivo)).toEqual(["parcelamento-COD-1-202609.pdf"]);
    expect(registrados).toHaveLength(0);
  });

  it("documento que o WhatsApp recusou não é registrado nem descontado, e não deixa caminho para reenvio", async () => {
    const { executar, registrados, mensagens, reencontradas } = montar([parcelamento("1")], {
      documentoFalha: true,
    });
    expect((await executar()).ok).toBe(true);
    expect(registrados).toHaveLength(0);
    expect(reencontradas).toHaveLength(0);
    expect(mensagens[0].texto).toContain("COD-1");
  });

  it("registro sem caminho (anterior à referência): não reenvia versão adivinhada e lista o parcelamento", async () => {
    const { executar, documentos, reencontradas, mensagens } = montar(
      [parcelamento("1", { parcelasEnviadas: ["202610"] })],
      { semCaminho: true },
    );
    expect((await executar()).ok).toBe(true);
    expect(reencontradas).toHaveLength(0);
    expect(documentos).toHaveLength(0);
    expect(mensagens[0].texto).toContain("COD-1");
  });

  it("falha ao ler as guias já entregues: nada é emitido nem enviado e todos os comuns são listados", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { executar, documentos, registrados, buscas, mensagens } = montar(
      [parcelamento("1"), parcelamento("2", { parcelasEnviadas: ["202610"] })],
      { entreguesFalha: true },
    );
    expect((await executar()).ok).toBe(true);
    expect(documentos).toHaveLength(0);
    expect(registrados).toHaveLength(0);
    expect(buscas()).toBe(0);
    expect(mensagens[0].texto).toMatch(/COD-1.*COD-2/);
    log.mockRestore();
  });

  it("registro não elegível após o envio: o contato recebeu, então não há aviso de falha", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { executar, documentos, mensagens } = montar([parcelamento("1")], {
      registro: "nao_elegivel",
    });
    expect((await executar()).ok).toBe(true);
    expect(documentos).toHaveLength(1);
    expect(mensagens).toHaveLength(0);
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it("guia que pertence ao interno não é entregue ao comum nem o interno é mencionado", async () => {
    const { executar, documentos, registrados, mensagens } = montar(
      [
        parcelamento("1", { valorParcelaCentavos: 30_000 }),
        parcelamento("2", { interno: true, valorParcelaCentavos: 24_000 }),
      ],
      { guias: ok([guia("202610", 25_000)]) },
    );
    expect((await executar()).ok).toBe(true);
    expect(documentos).toHaveLength(0);
    expect(registrados).toHaveLength(0);
    expect(mensagens[0].texto).toContain("COD-1");
    expect(mensagens[0].texto).not.toMatch(/COD-2|intern/i);
  });

  it.each([
    ["sem autorização", err(new ForbiddenError("sem autorização"))],
    ["provedor fora do ar", err(new ServicoExternoError("serpro"))],
  ])(
    "%s ao emitir a nova de um: reenvia o já registrado e lista só o afetado",
    async (_nome, guias) => {
      jest.spyOn(console, "error").mockImplementation(() => undefined);
      const { executar, documentos, mensagens, registrados } = montar(
        [parcelamento("1"), parcelamento("2", { parcelasEnviadas: ["202610"] })],
        { guias },
      );
      expect((await executar()).ok).toBe(true);
      expect(documentos.map((d) => d.nomeArquivo)).toEqual(["parcelamento-COD-2-202610.pdf"]);
      expect(registrados).toHaveLength(0);
      expect(mensagens).toHaveLength(1);
      expect(mensagens[0].texto).toContain("COD-1");
      expect(mensagens[0].texto).not.toContain("COD-2");
    },
  );

  it("falha ao emitir com todos sem registro: lista todos os afetados", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { executar, documentos, mensagens } = montar([parcelamento("1"), parcelamento("2")], {
      guias: err(new ServicoExternoError("serpro")),
    });
    expect((await executar()).ok).toBe(true);
    expect(documentos).toHaveLength(0);
    expect(mensagens[0].texto).toMatch(/COD-1.*COD-2/);
  });
});
