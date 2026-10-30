import type {
  AberturaAtendimento,
  AbrirAtendimentoPort,
  NovaMensagem,
} from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type { AnexarMensagemAtendimentoPort } from "@/modules/atendimento/application/ports/in/anexar-mensagem-atendimento.provider";
import type { EntregarNaUraPort } from "@/modules/atendimento/application/ports/in/entregar-na-ura.provider";
import type {
  DocumentoContratual,
  DocumentosContratuaisPort,
} from "@/modules/atendimento/application/ports/out/documentos-contratuais.provider";
import type {
  DocumentoEnviado,
  EnvioMensagemPort,
  MensagemEnviada,
} from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { FeriadosPort } from "@/modules/atendimento/application/ports/out/feriados.provider";
import type {
  GuiaFiscal,
  GuiasFiscaisPort,
  TipoGuia,
} from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type {
  ContatoAmbiguo,
  ContatoIdentificado,
  IdentificacaoContatoPort,
} from "@/modules/atendimento/application/ports/out/identificacao-contato.provider";
import type { RegistroDeErrosPort } from "@/modules/atendimento/application/ports/out/registro-de-erros.provider";
import type { RelogioPort } from "@/modules/atendimento/application/ports/out/relogio.provider";
import type {
  SessaoAtendimento,
  SessaoAtendimentoPort,
} from "@/modules/atendimento/application/ports/out/sessao-atendimento.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { normalizarCnpj } from "@/shared/kernel/cnpj";
import { err, ok, type Result } from "@/shared/kernel/result";

import { ReceberMensagem } from "./receber-mensagem.use-case";

const erros: RegistroDeErrosPort = { registrar: jest.fn() };

const ana: ContatoIdentificado = {
  clienteId: "cliente-1",
  nome: "Ana",
  empresa: "Padaria Pão Quente",
};

const CNPJ_CADASTRADO = "90.000.001/0001-29";
const CNPJ_DESCONHECIDO = "11.222.333/0001-81";

const CONTRATO: DocumentoContratual = {
  tipo: "contrato",
  numero: null,
  data: null,
  caminho: "c1/contrato.pdf",
};

function montar(
  opcoes: {
    contato?: ContatoIdentificado | ContatoAmbiguo | null;
    envioFalha?: boolean;
    documentos?: DocumentoContratual[];
    listagemFalha?: boolean;
    sessaoFalha?: boolean;
    limparFalha?: boolean;
    aberturaFalha?: boolean;
    emAndamento?: boolean;
    cnpjsCadastrados?: string[];
    cnpjFalha?: boolean;
    agora?: Date;
    feriados?: string[];
    feriadosFalha?: boolean;
    guiaFalha?: AppError | "lanca";
    dasFalha?: AppError | "lanca";
    parcelamentoFalha?: AppError | "lanca";
  } = {},
) {
  const buscados: string[] = [];
  const enviadas: MensagemEnviada[] = [];
  const documentosEnviados: DocumentoEnviado[] = [];
  const listados: string[] = [];
  const sessoes = new Map<string, SessaoAtendimento>();
  const gravadas: SessaoAtendimento[] = [];
  const sessao: SessaoAtendimentoPort = {
    obter: async (telefone) =>
      opcoes.sessaoFalha
        ? err(new ServicoExternoError("banco"))
        : ok(sessoes.get(telefone) ?? null),
    salvar: async (telefone, nova) => {
      sessoes.set(telefone, nova);
      gravadas.push(nova);
      return ok(undefined);
    },
    limpar: async (telefone) => {
      if (opcoes.limparFalha) return err(new ServicoExternoError("banco"));
      sessoes.delete(telefone);
      return ok(undefined);
    },
  };
  const identificacao: IdentificacaoContatoPort = {
    identificar: async (
      telefone,
    ): Promise<Result<ContatoIdentificado | ContatoAmbiguo | null, AppError>> => {
      buscados.push(telefone);
      return ok(opcoes.contato === undefined ? ana : opcoes.contato);
    },
    // Por padrão o CNPJ de teste existe em um Cliente (o número é que não é Contato).
    cnpjCadastrado: async (cnpj) =>
      opcoes.cnpjFalha
        ? err(new ServicoExternoError("banco"))
        : ok(
            (opcoes.cnpjsCadastrados ?? [CNPJ_CADASTRADO]).some(
              (c) => normalizarCnpj(c) === normalizarCnpj(cnpj),
            ),
          ),
  };
  const envio: EnvioMensagemPort = {
    enviar: async (m) => {
      if (opcoes.envioFalha) throw new Error("rede");
      enviadas.push(m);
      return ok(undefined);
    },
    reagir: async () => ok(undefined),
    enviarAnexo: async () => ok(undefined),
    enviarDocumento: async (d) => {
      if (opcoes.envioFalha) throw new Error("rede");
      documentosEnviados.push(d);
      return ok(undefined);
    },
    enviarTemplate: async () => ok(undefined),
  };
  const documentos: DocumentosContratuaisPort = {
    listar: async (clienteId) => {
      listados.push(clienteId);
      if (opcoes.listagemFalha) return err(new ServicoExternoError("banco"));
      return ok(opcoes.documentos ?? []);
    },
    linkTemporario: async (caminho) => ok(`https://storage.test/${caminho}?token=x`),
  };
  const abertos: AberturaAtendimento[] = [];
  const anexadas: NovaMensagem[] = [];
  const tentativasDeAnexar: NovaMensagem[] = [];
  const mensagens: AnexarMensagemAtendimentoPort = {
    execute: async ({ mensagem }) => {
      tentativasDeAnexar.push(mensagem);
      if (!opcoes.emAndamento) return ok({ anexada: false });
      anexadas.push(mensagem);
      return ok({ anexada: true });
    },
  };
  const atendimentos: AbrirAtendimentoPort = {
    execute: async (a) => {
      if (opcoes.aberturaFalha) return err(new ServicoExternoError("banco"));
      abertos.push(a);
      return ok({ id: "at-1" });
    },
  };
  // Por padrão: quarta-feira, 10h em São Paulo (expediente aberto).
  const relogio: RelogioPort = {
    agora: () => opcoes.agora ?? new Date("2026-10-07T10:00:00-03:00"),
  };
  const feriados: FeriadosPort = {
    listarDatas: async () =>
      opcoes.feriadosFalha ? err(new ServicoExternoError("banco")) : ok(opcoes.feriados ?? []),
  };
  const guiasBuscadas: { clienteId: string; tipo: TipoGuia }[] = [];
  const guias: GuiasFiscaisPort = {
    buscar: async (clienteId, tipo) => {
      guiasBuscadas.push({ clienteId, tipo });
      if (opcoes.guiaFalha === "lanca") throw new Error("rede");
      if (opcoes.guiaFalha) return err(opcoes.guiaFalha);
      return ok<GuiaFiscal>({ nomeArquivo: `${tipo}.pdf`, pdfBase64: `pdf-${tipo}` });
    },
  };
  const dasPedidos: { clienteId: string; telefone: string }[] = [];
  const das: EntregarNaUraPort = {
    execute: async (pedido) => {
      dasPedidos.push(pedido);
      if (opcoes.dasFalha === "lanca") throw new Error("rede");
      if (opcoes.dasFalha) return err(opcoes.dasFalha);
      return ok(undefined);
    },
  };
  const parcelamentoPedidos: { clienteId: string; telefone: string }[] = [];
  const parcelamento: EntregarNaUraPort = {
    execute: async (pedido) => {
      parcelamentoPedidos.push(pedido);
      if (opcoes.parcelamentoFalha === "lanca") throw new Error("rede");
      if (opcoes.parcelamentoFalha) return err(opcoes.parcelamentoFalha);
      return ok(undefined);
    },
  };
  return {
    guiasBuscadas,
    dasPedidos,
    parcelamentoPedidos,
    anexadas,
    tentativasDeAnexar,
    abertos,
    caso: new ReceberMensagem(
      identificacao,
      envio,
      documentos,
      sessao,
      atendimentos,
      mensagens,
      relogio,
      feriados,
      guias,
      das,
      parcelamento,
      erros,
    ),
    sessoes,
    gravadas,
    buscados,
    enviadas,
    documentosEnviados,
    listados,
  };
}

describe("ReceberMensagem", () => {
  it("normaliza o telefone (máscara e DDI) antes de identificar o contato", async () => {
    const { caso, buscados } = montar();
    await caso.execute({ telefone: "+55 (11) 91234-5678", texto: "oi" });
    expect(buscados).toEqual(["11912345678"]);
  });

  it("cliente reconhecido recebe saudação nominal e o menu", async () => {
    const { caso, enviadas } = montar();
    const r = await caso.execute({ telefone: "5511912345678", texto: "oi" });
    expect(r.ok).toBe(true);
    expect(enviadas).toHaveLength(1);
    expect(enviadas[0].telefone).toBe("5511912345678");
    expect(enviadas[0].texto).toContain("Ana");
    expect(enviadas[0].texto).toContain("Padaria Pão Quente");
    for (const opcao of ["Contrato social", "imposto", "parcelamento", "CND", "atendente"]) {
      expect(enviadas[0].texto).toContain(opcao);
    }
  });

  it("opção 3 (parcelamento) segue o processo do job: delega ao caso do parcelamento, sem buscar a guia direto", async () => {
    const { caso, parcelamentoPedidos, guiasBuscadas, enviadas, documentosEnviados } = montar();
    const r = await caso.execute({ telefone: "5511912345678", texto: " 3 " });
    expect(r.ok).toBe(true);
    expect(parcelamentoPedidos).toEqual([{ clienteId: ana.clienteId, telefone: "5511912345678" }]);
    expect(guiasBuscadas).toEqual([]);
    expect(enviadas).toHaveLength(0);
    expect(documentosEnviados).toHaveLength(0);
  });

  it("parcelamento sem autorização vigente avisa o contato e oferece o atendente", async () => {
    const { caso, enviadas } = montar({ parcelamentoFalha: new ForbiddenError("sem autorização") });
    const r = await caso.execute({ telefone: "11912345678", texto: "3" });
    expect(r.ok).toBe(true);
    expect(enviadas[0].texto).toContain("autorização");
    expect(enviadas[0].texto).toContain("*5*");
  });

  it.each([new ServicoExternoError("fora do ar"), "lanca" as const])(
    "falha do parcelamento (%p) não derruba: registra no log e avisa o contato",
    async (parcelamentoFalha) => {
      const log = jest.mocked(erros.registrar).mockClear();
      const { caso, enviadas } = montar({ parcelamentoFalha });
      const r = await caso.execute({ telefone: "11912345678", texto: "3" });
      expect(r.ok).toBe(true);
      expect(enviadas[0].texto).toContain("agora");
      expect(log).toHaveBeenCalledTimes(1);
    },
  );

  it("opção 4 do menu entrega o PDF de CND do Cliente do contato", async () => {
    const { caso, enviadas, documentosEnviados, guiasBuscadas } = montar();
    const r = await caso.execute({ telefone: "5511912345678", texto: "4" });
    expect(r.ok).toBe(true);
    // O CNPJ nunca é perguntado: a busca usa o Cliente ligado ao contato.
    expect(guiasBuscadas).toEqual([{ clienteId: ana.clienteId, tipo: "cnd" }]);
    expect(documentosEnviados).toEqual([
      { telefone: "5511912345678", nomeArquivo: "cnd.pdf", pdfBase64: "pdf-cnd" },
    ]);
    expect(enviadas).toHaveLength(0);
  });

  it("opção 2 (DAS) segue o processo do job: delega ao caso do DAS, sem buscar a guia direto", async () => {
    const { caso, dasPedidos, guiasBuscadas, enviadas, documentosEnviados } = montar();
    const r = await caso.execute({ telefone: "5511912345678", texto: "2" });
    expect(r.ok).toBe(true);
    expect(dasPedidos).toEqual([{ clienteId: ana.clienteId, telefone: "5511912345678" }]);
    expect(guiasBuscadas).toEqual([]);
    expect(enviadas).toHaveLength(0);
    expect(documentosEnviados).toHaveLength(0);
  });

  it("DAS sem autorização vigente avisa o contato e oferece o atendente", async () => {
    const { caso, enviadas } = montar({ dasFalha: new ForbiddenError("sem autorização") });
    const r = await caso.execute({ telefone: "11912345678", texto: "2" });
    expect(r.ok).toBe(true);
    expect(enviadas[0].texto).toContain("autorização");
    expect(enviadas[0].texto).toContain("*5*");
  });

  it.each([new ServicoExternoError("fora do ar"), "lanca" as const])(
    "falha do DAS (%p) não derruba: registra no log, avisa o contato e oferece o atendente",
    async (dasFalha) => {
      const log = jest.mocked(erros.registrar).mockClear();
      const { caso, enviadas } = montar({ dasFalha });
      const r = await caso.execute({ telefone: "11912345678", texto: "2" });
      expect(r.ok).toBe(true);
      expect(enviadas[0].texto).toContain("agora");
      expect(enviadas[0].texto).toContain("*5*");
      expect(log).toHaveBeenCalledTimes(1);
    },
  );

  it("guia sem autorização vigente avisa o contato e oferece o atendente", async () => {
    const { caso, enviadas, documentosEnviados } = montar({
      guiaFalha: new ForbiddenError("sem autorização"),
    });
    const r = await caso.execute({ telefone: "11912345678", texto: "4" });
    expect(r.ok).toBe(true);
    expect(documentosEnviados).toHaveLength(0);
    expect(enviadas[0].texto).toContain("autorização");
    expect(enviadas[0].texto).toContain("*5*");
  });

  it.each([
    new ServicoExternoError("fora do ar"),
    new NotFoundError("sem cliente"),
    "lanca" as const,
  ])(
    "falha do provedor fiscal (%p) não derruba: registra no log, avisa o contato e oferece o atendente",
    async (guiaFalha) => {
      const log = jest.mocked(erros.registrar).mockClear();
      const { caso, enviadas, documentosEnviados } = montar({ guiaFalha });
      const r = await caso.execute({ telefone: "11912345678", texto: "4" });
      expect(r.ok).toBe(true);
      expect(documentosEnviados).toHaveLength(0);
      expect(enviadas[0].texto).toContain("agora");
      expect(enviadas[0].texto).toContain("*5*");
      expect(log).toHaveBeenCalledTimes(1);
    },
  );

  it("falha ao enviar o PDF devolve erro para a Meta reenviar", async () => {
    const { caso } = montar({ envioFalha: true });
    const r = await caso.execute({ telefone: "11912345678", texto: "4" });
    expect(r).toEqual({ ok: false, error: expect.any(ServicoExternoError) });
  });

  it("texto que coincide com chave herdada de objeto não vira guia", async () => {
    const { caso, guiasBuscadas } = montar();
    const r = await caso.execute({ telefone: "11912345678", texto: "constructor" });
    expect(r.ok).toBe(true);
    expect(guiasBuscadas).toEqual([]);
  });

  it("telefone sem dígitos é rejeitado", async () => {
    const { caso, enviadas } = montar();
    const r = await caso.execute({ telefone: "abc", texto: "oi" });
    expect(r.ok).toBe(false);
    expect(enviadas).toHaveLength(0);
  });

  it("falha do adapter de envio vira erro de serviço externo", async () => {
    const { caso } = montar({ envioFalha: true });
    const r = await caso.execute({ telefone: "11912345678", texto: "oi" });
    expect(r).toEqual({ ok: false, error: expect.any(ServicoExternoError) });
  });

  it("propaga erro da identificação sem enviar nada", async () => {
    const enviadas: MensagemEnviada[] = [];
    const caso = new ReceberMensagem(
      {
        identificar: async () => err(new ServicoExternoError("banco")),
        cnpjCadastrado: async () => err(new ServicoExternoError("banco")),
      },
      {
        enviar: async (m) => {
          enviadas.push(m);
          return ok(undefined);
        },
        enviarDocumento: async () => ok(undefined),
        enviarTemplate: async () => ok(undefined),
        enviarAnexo: async () => ok(undefined),
        reagir: async () => ok(undefined),
      },
      { listar: async () => ok([]), linkTemporario: async () => ok("x") },
      {
        obter: async () => ok(null),
        salvar: async () => ok(undefined),
        limpar: async () => ok(undefined),
      },
      { execute: async () => ok({ id: "at-1" }) },
      { execute: async () => ok({ anexada: false }) },
      { agora: () => new Date("2026-10-07T10:00:00-03:00") },
      { listarDatas: async () => ok([]) },
      { buscar: async () => err(new ServicoExternoError("fiscal")) },
      { execute: async () => ok(undefined) },
      { execute: async () => ok(undefined) },
      erros,
    );
    const r = await caso.execute({ telefone: "11912345678", texto: "oi" });
    expect(r.ok).toBe(false);
    expect(enviadas).toHaveLength(0);
  });
});

describe("ReceberMensagem — fora do expediente (#72)", () => {
  const QUARTA_19H = new Date("2026-10-07T19:00:00-03:00");

  it("só avisa o horário, sem menu, e diz quando volta", async () => {
    const { caso, enviadas } = montar({ agora: QUARTA_19H });
    const r = await caso.execute({ telefone: FONE, texto: "oi" });
    expect(r.ok).toBe(true);
    expect(enviadas).toHaveLength(1);
    expect(enviadas[0].telefone).toBe(FONE);
    expect(enviadas[0].texto).toMatch(/fechado.*amanhã.*8h/);
    expect(enviadas[0].texto).not.toContain("1 - ");
  });

  it("não identifica, não grava sessão, não entrega documento e não abre Atendimento", async () => {
    const { caso, buscados, gravadas, sessoes, documentosEnviados, abertos } = montar({
      agora: QUARTA_19H,
      documentos: [CONTRATO],
    });
    await caso.execute({ telefone: FONE, texto: "1" });
    await caso.execute({ telefone: FONE, texto: "5" });
    expect(buscados).toHaveLength(0);
    expect(gravadas).toHaveLength(0);
    expect(sessoes.size).toBe(0);
    expect(documentosEnviados).toHaveLength(0);
    expect(abertos).toHaveLength(0);
  });

  it("número não cadastrado também só recebe o aviso", async () => {
    const { caso, enviadas, gravadas, abertos } = montar({ agora: QUARTA_19H, contato: null });
    await caso.execute({ telefone: FONE, texto: "oi" });
    await caso.execute({ telefone: FONE, texto: "quero um atendente" });
    expect(enviadas.every((e) => /fechado/.test(e.texto))).toBe(true);
    expect(gravadas).toHaveLength(0);
    expect(abertos).toHaveLength(0);
  });

  it("pedido de atendente, respostas inválidas e CNPJ inexistente também só recebem o aviso", async () => {
    const { caso, enviadas, abertos, gravadas, sessoes } = montar({
      agora: QUARTA_19H,
      contato: null,
      cnpjsCadastrados: [],
    });
    for (const texto of ["5", "sim", "xx", "yy", "zz", CNPJ_DESCONHECIDO, CNPJ_DESCONHECIDO]) {
      await caso.execute({ telefone: FONE, texto });
    }
    expect(enviadas).toHaveLength(7);
    expect(enviadas.every((e) => /fechado/.test(e.texto))).toBe(true);
    expect(abertos).toHaveLength(0);
    expect(gravadas).toHaveLength(0);
    expect(sessoes.size).toBe(0);
  });

  it("Atendimento em andamento continua recebendo a Mensagem, sem aviso", async () => {
    const { caso, enviadas, anexadas } = montar({ agora: QUARTA_19H, emAndamento: true });
    const r = await caso.execute({ telefone: FONE, texto: "ainda aí?" });
    expect(r.ok).toBe(true);
    expect(anexadas).toEqual([{ autor: "contato", texto: "ainda aí?" }]);
    expect(enviadas).toHaveLength(0);
  });

  it("guarda o id da Mensagem no provedor ao anexar e ao abrir o Atendimento (#84)", async () => {
    const anexo = montar({ agora: QUARTA_19H, emAndamento: true });
    await anexo.caso.execute({ telefone: FONE, texto: "ainda aí?", id: "wamid.ANEXO" });
    expect(anexo.anexadas).toEqual([
      { autor: "contato", texto: "ainda aí?", idExterno: "wamid.ANEXO" },
    ]);

    const abertura = montar();
    await abertura.caso.execute({ telefone: FONE, texto: "5", id: "wamid.ABERTURA" });
    expect(abertura.abertos[0].mensagens[0]).toMatchObject({
      autor: "contato",
      idExterno: "wamid.ABERTURA",
    });
  });

  it("feriado cadastrado pelo Admin fecha o expediente", async () => {
    const { caso, enviadas } = montar({ feriados: ["2026-10-07"] });
    await caso.execute({ telefone: FONE, texto: "oi" });
    expect(enviadas[0].texto).toMatch(/fechado.*amanhã/);
  });

  it("dentro do expediente nada muda: saudação com menu", async () => {
    const { caso, enviadas } = montar({ agora: new Date("2026-10-07T17:59:00-03:00") });
    await caso.execute({ telefone: FONE, texto: "oi" });
    expect(enviadas[0].texto).toContain("Ana");
  });

  it("fechado pelo calendário nacional, falha ao ler os feriados vira erro: nunca promete uma data", async () => {
    const quartaApos18h = new Date("2026-10-21T18:01:00-03:00");
    const { caso, enviadas } = montar({ agora: quartaApos18h, feriadosFalha: true });
    const r = await caso.execute({ telefone: FONE, texto: "oi" });
    expect(r).toEqual({ ok: false, error: expect.any(ServicoExternoError) });
    expect(enviadas).toHaveLength(0);
  });

  it("aberto pelo calendário nacional, falha ao ler os feriados vira erro, sem responder nada", async () => {
    const { caso, enviadas } = montar({ feriadosFalha: true });
    const r = await caso.execute({ telefone: FONE, texto: "oi" });
    expect(r).toEqual({ ok: false, error: expect.any(ServicoExternoError) });
    expect(enviadas).toHaveLength(0);
  });

  it("falha do envio do aviso vira erro de serviço externo", async () => {
    const { caso } = montar({ agora: QUARTA_19H, envioFalha: true });
    const r = await caso.execute({ telefone: FONE, texto: "oi" });
    expect(r).toEqual({ ok: false, error: expect.any(ServicoExternoError) });
  });
});

function alteracoes(quantidade: number): DocumentoContratual[] {
  // Como o gateway entrega: nº decrescente. As datas correm ao contrário, para provar que a
  // ordem é pelo nº.
  return Array.from({ length: quantidade }, (_, i) => ({
    tipo: "alteracao" as const,
    numero: i + 1,
    data: `2020-${String(quantidade - i).padStart(2, "0")}-15`,
    caminho: `c1/alt-${i + 1}.pdf`,
  })).reverse();
}

const nomes = (docs: DocumentoEnviado[]) => docs.map((d) => d.nomeArquivo);
const FONE = "5511912345678";
const CHAVE = "11912345678";

describe("ReceberMensagem — contrato social e alterações (opção 1)", () => {
  it("opção 1 pergunta contrato, alterações ou ambos e guarda só a etapa", async () => {
    const { caso, enviadas, documentosEnviados, gravadas } = montar({ documentos: [CONTRATO] });
    await caso.execute({ telefone: FONE, texto: "1" });
    expect(documentosEnviados).toHaveLength(0);
    for (const opcao of ["Contrato social", "Alterações", "Ambos"]) {
      expect(enviadas[0].texto).toContain(opcao);
    }
    expect(gravadas).toEqual([{ etapa: "tipo_documento" }]);
  });

  it("escolher contrato envia o contrato e encerra a sessão", async () => {
    const { caso, documentosEnviados, sessoes } = montar({ documentos: [CONTRATO] });
    await caso.execute({ telefone: FONE, texto: "1" });
    await caso.execute({ telefone: FONE, texto: "1" });
    expect(documentosEnviados).toEqual([
      {
        telefone: FONE,
        url: "https://storage.test/c1/contrato.pdf?token=x",
        nomeArquivo: "Contrato social.pdf",
      },
    ]);
    expect(sessoes.size).toBe(0);
  });

  it("escolher contrato sem contrato cadastrado avisa", async () => {
    const { caso, documentosEnviados, enviadas } = montar({ documentos: alteracoes(2) });
    await caso.execute({ telefone: FONE, texto: "1" });
    await caso.execute({ telefone: FONE, texto: "1" });
    expect(documentosEnviados).toHaveLength(0);
    expect(enviadas[1].texto).toContain("Não encontramos");
  });

  it("alterações com uma só: envia direto", async () => {
    const { caso, documentosEnviados, sessoes } = montar({
      documentos: [CONTRATO, ...alteracoes(1)],
    });
    await caso.execute({ telefone: FONE, texto: "1" });
    await caso.execute({ telefone: FONE, texto: "2" });
    expect(nomes(documentosEnviados)).toEqual(["Alteração nº 1 - 15/01/2020.pdf"]);
    expect(sessoes.size).toBe(0);
  });

  it("alterações sem nenhuma cadastrada avisa", async () => {
    const { caso, documentosEnviados, enviadas } = montar({ documentos: [CONTRATO] });
    await caso.execute({ telefone: FONE, texto: "1" });
    await caso.execute({ telefone: FONE, texto: "2" });
    expect(documentosEnviados).toHaveLength(0);
    expect(enviadas[1].texto).toContain("Não encontramos");
  });

  it("várias alterações: lista por nº decrescente e envia a escolhida", async () => {
    const { caso, documentosEnviados, enviadas } = montar({
      documentos: [CONTRATO, ...alteracoes(3)],
    });
    await caso.execute({ telefone: FONE, texto: "1" });
    await caso.execute({ telefone: FONE, texto: "2" });
    const lista = enviadas[1].texto;
    expect(lista.indexOf("nº 3")).toBeLessThan(lista.indexOf("nº 2"));
    expect(lista.indexOf("nº 2")).toBeLessThan(lista.indexOf("nº 1"));
    await caso.execute({ telefone: FONE, texto: "1" });
    expect(nomes(documentosEnviados)).toEqual(["Alteração nº 3 - 15/01/2020.pdf"]);
  });

  it("pagina de 10 em 10 com 'mais' e escolhe pelo número da página corrente", async () => {
    const { caso, documentosEnviados, enviadas, gravadas } = montar({
      documentos: alteracoes(12),
    });
    await caso.execute({ telefone: FONE, texto: "1" });
    await caso.execute({ telefone: FONE, texto: "2" });
    expect(enviadas[1].texto).toContain("mais");
    expect(enviadas[1].texto.match(/^\d+ - /gm)).toHaveLength(10);

    await caso.execute({ telefone: FONE, texto: "mais" });
    expect(enviadas[2].texto.match(/^\d+ - /gm)).toHaveLength(2);
    expect(enviadas[2].texto).not.toContain("mais");
    expect(gravadas.at(-1)).toEqual({
      etapa: "alteracao",
      modo: "alteracoes",
      pagina: 2,
      lista: expect.any(String),
    });

    await caso.execute({ telefone: FONE, texto: "2" });
    expect(nomes(documentosEnviados)).toEqual(["Alteração nº 1 - 15/12/2020.pdf"]);
  });

  it("'mais' na última página e número fora da lista reapresentam a página", async () => {
    const { caso, documentosEnviados, enviadas } = montar({ documentos: alteracoes(3) });
    await caso.execute({ telefone: FONE, texto: "1" });
    await caso.execute({ telefone: FONE, texto: "2" });
    await caso.execute({ telefone: FONE, texto: "mais" });
    await caso.execute({ telefone: FONE, texto: "9" });
    expect(documentosEnviados).toHaveLength(0);
    expect(enviadas).toHaveLength(4);
    expect(enviadas[3].texto).toContain("Alteração nº 3");
  });

  it("ambos com várias alterações: após escolher, envia o contrato e a alteração", async () => {
    const { caso, documentosEnviados, gravadas } = montar({
      documentos: [CONTRATO, ...alteracoes(3)],
    });
    await caso.execute({ telefone: FONE, texto: "1" });
    await caso.execute({ telefone: FONE, texto: "3" });
    expect(gravadas.at(-1)).toEqual({
      etapa: "alteracao",
      modo: "ambos",
      pagina: 1,
      lista: expect.any(String),
    });
    await caso.execute({ telefone: FONE, texto: "2" });
    expect(nomes(documentosEnviados)).toEqual([
      "Contrato social.pdf",
      "Alteração nº 2 - 15/02/2020.pdf",
    ]);
  });

  it("ambos com uma única alteração envia os dois direto", async () => {
    const { caso, documentosEnviados } = montar({ documentos: [CONTRATO, ...alteracoes(1)] });
    await caso.execute({ telefone: FONE, texto: "1" });
    await caso.execute({ telefone: FONE, texto: "3" });
    expect(nomes(documentosEnviados)).toEqual([
      "Contrato social.pdf",
      "Alteração nº 1 - 15/01/2020.pdf",
    ]);
  });

  it("ambos sem contrato cadastrado avisa e envia a alteração escolhida", async () => {
    const { caso, documentosEnviados, enviadas } = montar({ documentos: alteracoes(3) });
    await caso.execute({ telefone: FONE, texto: "1" });
    await caso.execute({ telefone: FONE, texto: "3" });
    await caso.execute({ telefone: FONE, texto: "1" });
    expect(enviadas.at(-1)?.texto).toContain("Não encontramos o contrato");
    expect(nomes(documentosEnviados)).toEqual(["Alteração nº 3 - 15/01/2020.pdf"]);
  });

  it("regressão: 12 alterações paginam 10 + 2 por nº decrescente e o hash da lista guardado não muda", async () => {
    const { caso, enviadas, gravadas } = montar({ documentos: alteracoes(12) });
    await caso.execute({ telefone: FONE, texto: "1" });
    await caso.execute({ telefone: FONE, texto: "2" });
    const numeros = [...enviadas[1].texto.matchAll(/^\d+ - Alteração nº (\d+)/gm)].map(
      (m) => +m[1],
    );
    expect(numeros).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
    expect(enviadas[1].texto).toContain("página 1 de 2");
    await caso.execute({ telefone: FONE, texto: "mais" });
    expect(enviadas[2].texto).toContain("página 2 de 2");
    // Valor fixo: o hash vem só dos caminhos, na ordem exibida (alt-12 … alt-1).
    expect(gravadas[0]).toEqual({ etapa: "tipo_documento" });
    expect(gravadas[1]).toMatchObject({ pagina: 1, lista: "1m5itzn0pj2" });
  });

  it("sessão numa página que deixou de existir volta à última página", async () => {
    const { caso, enviadas, sessoes } = montar({ documentos: alteracoes(12) });
    await caso.execute({ telefone: FONE, texto: "1" });
    await caso.execute({ telefone: FONE, texto: "2" });
    sessoes.set(CHAVE, { ...(sessoes.get(CHAVE) as object), pagina: 5 } as never);
    await caso.execute({ telefone: FONE, texto: "mais" });
    expect(enviadas[2].texto).toContain("página 2 de 2");
    expect(enviadas[2].texto.match(/^\d+ - /gm)).toHaveLength(2);
  });

  it("ambos sem alterações envia só o contrato", async () => {
    const { caso, documentosEnviados } = montar({ documentos: [CONTRATO] });
    await caso.execute({ telefone: FONE, texto: "1" });
    await caso.execute({ telefone: FONE, texto: "3" });
    expect(nomes(documentosEnviados)).toEqual(["Contrato social.pdf"]);
  });

  it("opção inválida na pergunta repete a pergunta e mantém a sessão", async () => {
    const { caso, enviadas, sessoes } = montar({ documentos: [CONTRATO] });
    await caso.execute({ telefone: FONE, texto: "1" });
    await caso.execute({ telefone: FONE, texto: "banana" });
    expect(enviadas[1].texto).toContain("Ambos");
    expect(sessoes.get(CHAVE)).toEqual({ etapa: "tipo_documento" });
  });

  it("'menu' abandona a sessão e reabre o menu", async () => {
    const { caso, enviadas, sessoes } = montar({ documentos: alteracoes(3) });
    await caso.execute({ telefone: FONE, texto: "1" });
    await caso.execute({ telefone: FONE, texto: "2" });
    await caso.execute({ telefone: FONE, texto: " Menu " });
    expect(sessoes.size).toBe(0);
    expect(enviadas[2].texto).toContain("Olá, Ana");
  });

  it("a sessão nunca guarda dado do Cliente, só etapa, modo, página e o hash da lista (sem caminho)", async () => {
    const { caso, gravadas } = montar({ documentos: [CONTRATO, ...alteracoes(12)] });
    await caso.execute({ telefone: FONE, texto: "1" });
    await caso.execute({ telefone: FONE, texto: "3" });
    await caso.execute({ telefone: FONE, texto: "mais" });
    for (const g of gravadas) {
      expect(Object.keys(g).every((k) => ["etapa", "modo", "pagina", "lista"].includes(k))).toBe(
        true,
      );
      if (g.etapa === "alteracao") expect(g.lista).toMatch(/^[0-9a-z]+$/);
    }
  });

  it("falha ao listar os documentos propaga o erro e mantém a sessão", async () => {
    const { caso, documentosEnviados, sessoes } = montar({ listagemFalha: true });
    sessoes.set(CHAVE, { etapa: "tipo_documento" });
    const r = await caso.execute({ telefone: FONE, texto: "1" });
    expect(r.ok).toBe(false);
    expect(documentosEnviados).toHaveLength(0);
    expect(sessoes.size).toBe(1);
  });

  it("falha do adapter ao enviar o documento vira erro de serviço externo e mantém a sessão", async () => {
    const { caso, sessoes } = montar({ documentos: [CONTRATO], envioFalha: true });
    sessoes.set(CHAVE, { etapa: "tipo_documento" });
    const r = await caso.execute({ telefone: FONE, texto: "1" });
    expect(r).toEqual({ ok: false, error: expect.any(ServicoExternoError) });
    expect(sessoes.size).toBe(1);
  });

  it("falha ao encerrar a sessão depois da entrega não faz a Meta reenviar o documento", async () => {
    const { caso, documentosEnviados, sessoes } = montar({
      documentos: [CONTRATO],
      limparFalha: true,
    });
    sessoes.set(CHAVE, { etapa: "tipo_documento" });
    const r = await caso.execute({ telefone: FONE, texto: "1" });
    expect(r.ok).toBe(true);
    expect(documentosEnviados).toHaveLength(1);
  });

  it("falha ao consultar a sessão propaga o erro sem enviar nada", async () => {
    const { caso, enviadas } = montar({ sessaoFalha: true });
    const r = await caso.execute({ telefone: FONE, texto: "1" });
    expect(r.ok).toBe(false);
    expect(enviadas).toHaveLength(0);
  });

  it("número desconhecido nunca chega aos documentos, nem com sessão de documento sobrando", async () => {
    const { caso, listados, sessoes } = montar({ contato: null });
    sessoes.set("11900000000", { etapa: "tipo_documento" });
    const r = await caso.execute({ telefone: "11900000000", texto: "1" });
    expect(r.ok).toBe(true);
    expect(listados).toHaveLength(0);
    expect(sessoes.get("11900000000")).toEqual({ etapa: "ja_cliente", invalidos: 0 });
  });
});

describe("ReceberMensagem — número não cadastrado (#43)", () => {
  const TEL = "11900000000";
  const dizer = (caso: ReturnType<typeof montar>["caso"], texto: string) =>
    caso.execute({ telefone: TEL, texto });

  it("recebe a pergunta 'você já é cliente?' e não vê o menu", async () => {
    const { caso, enviadas, sessoes } = montar({ contato: null });
    expect((await dizer(caso, "oi")).ok).toBe(true);
    expect(enviadas[0].texto).toContain("já é cliente");
    expect(enviadas[0].texto).not.toContain("1 - Contrato");
    expect(sessoes.get(TEL)).toEqual({ etapa: "ja_cliente", invalidos: 0 });
  });

  it("resposta negativa transfere pra recepção com aviso amigável e encerra a sessão", async () => {
    const { caso, enviadas, sessoes } = montar({ contato: null });
    await dizer(caso, "oi");
    await dizer(caso, "Não");
    expect(enviadas[1].texto).toContain("recepção");
    expect(sessoes.has(TEL)).toBe(false);
  });

  it("resposta fora de sim/não repete a pergunta", async () => {
    const { caso, enviadas, sessoes } = montar({ contato: null });
    await dizer(caso, "oi");
    await dizer(caso, "talvez");
    expect(enviadas[1].texto).toContain("*sim*");
    expect(sessoes.get(TEL)).toEqual({ etapa: "ja_cliente", invalidos: 1 });
  });

  it("resposta positiva pede o CNPJ", async () => {
    const { caso, enviadas, sessoes } = montar({ contato: null });
    await dizer(caso, "oi");
    await dizer(caso, "sim");
    expect(enviadas[1].texto).toContain("CNPJ");
    expect(sessoes.get(TEL)).toEqual({ etapa: "cnpj", invalidos: 0 });
  });

  it("CNPJ inválido pede de novo, sem transferir", async () => {
    const { caso, enviadas, sessoes } = montar({ contato: null });
    for (const t of ["oi", "sim", "123"]) await dizer(caso, t);
    expect(enviadas[2].texto).toContain("CNPJ");
    expect(sessoes.get(TEL)).toEqual({ etapa: "cnpj", invalidos: 1 });
  });

  it("CNPJ válido sem o contato transfere pra recepção e encerra a sessão", async () => {
    const { caso, enviadas, sessoes } = montar({ contato: null });
    for (const t of ["oi", "sim", "90.000.001/0001-29"]) await dizer(caso, t);
    expect(enviadas[2].texto).toContain("recepção");
    expect(sessoes.has(TEL)).toBe(false);
  });

  it("'menu' recomeça pela pergunta", async () => {
    const { caso, sessoes } = montar({ contato: null });
    for (const t of ["oi", "sim", "menu"]) await dizer(caso, t);
    expect(sessoes.get(TEL)).toEqual({ etapa: "ja_cliente", invalidos: 0 });
  });

  it("a transferência abre Atendimento na recepção com as Mensagens da conversa", async () => {
    const { caso, abertos } = montar({ contato: null });
    for (const t of ["oi", "sim", "90.000.001/0001-29"]) await dizer(caso, t);
    expect(abertos).toHaveLength(1);
    expect(abertos[0]).toMatchObject({ telefone: TEL, clienteId: null, setor: "recepcao" });
    expect(abertos[0].mensagens.map((m) => m.autor)).toEqual(["contato", "ura"]);
    expect(abertos[0].mensagens[0].texto).toBe("90.000.001/0001-29");
  });

  it("depois do aviso da recepção o cliente só recebe para aguardar, sem posição", async () => {
    const { caso, enviadas, tentativasDeAnexar } = montar({ contato: null });
    for (const t of ["oi", "sim", "90.000.001/0001-29"]) await dizer(caso, t);
    const texto = "Aguarde, já vamos atendê-lo.";
    expect(enviadas.map((e) => e.texto)).toEqual([
      expect.stringContaining("Você já é cliente"),
      expect.stringContaining("Informe o CNPJ"),
      expect.stringContaining("recepção"),
      texto,
    ]);
    expect(tentativasDeAnexar.filter((m) => m.autor === "ura")).toEqual([{ autor: "ura", texto }]);
  });

  it("falha ao abrir o Atendimento devolve o erro e mantém a sessão", async () => {
    const { caso, sessoes } = montar({ contato: null, aberturaFalha: true });
    await dizer(caso, "oi");
    expect((await dizer(caso, "não")).ok).toBe(false);
    expect(sessoes.get(TEL)).toEqual({ etapa: "ja_cliente", invalidos: 0 });
  });

  it("número com Atendimento em andamento tem a Mensagem anexada e a URA não recomeça", async () => {
    const { caso, enviadas, anexadas, abertos, sessoes } = montar({
      contato: null,
      emAndamento: true,
    });
    const r = await caso.execute({ telefone: "5511900000000", texto: "alguém aí?" });
    expect(r.ok).toBe(true);
    expect(anexadas).toEqual([{ autor: "contato", texto: "alguém aí?" }]);
    expect(enviadas).toHaveLength(0);
    expect(abertos).toHaveLength(0);
    expect(sessoes.size).toBe(0);
  });

  it("a abertura leva a chave nacional do telefone", async () => {
    const { caso, abertos } = montar({ contato: null });
    for (const t of ["oi", "não"]) await caso.execute({ telefone: "5511900000000", texto: t });
    expect(abertos[0]).toMatchObject({ telefone: "5511900000000", chave: "11900000000" });
  });
});

describe("ReceberMensagem — mesmo número em mais de um Cliente", () => {
  it.each(["oi", "1", "menu", "3"])(
    "'%s' vai pra recepção, sem menu nem documento, mesmo havendo contratos",
    async (texto) => {
      const { caso, enviadas, documentosEnviados, listados, sessoes, abertos } = montar({
        contato: "ambiguo",
        documentos: [CONTRATO],
      });
      sessoes.set(CHAVE, { etapa: "tipo_documento" });

      expect((await caso.execute({ telefone: FONE, texto })).ok).toBe(true);

      expect(enviadas).toHaveLength(2);
      expect(enviadas[0].texto).toContain("mais de uma empresa");
      expect(enviadas[0].texto).toContain("recepção");
      expect(enviadas[0].texto).not.toContain("1 - Contrato");
      expect(documentosEnviados).toEqual([]);
      expect(listados).toEqual([]);
      expect(sessoes.has(CHAVE)).toBe(false);
      expect(abertos).toHaveLength(1);
      expect(abertos[0]).toMatchObject({ clienteId: null, setor: "recepcao" });
    },
  );
});

describe("ReceberMensagem — lista de alterações mudou com a sessão aberta", () => {
  it.each([
    ["uma alteração é incluída", (docs: DocumentoContratual[]) => docs.unshift(alteracoes(4)[0])],
    ["uma alteração é excluída", (docs: DocumentoContratual[]) => docs.splice(0, 1)],
  ])(
    "se %s entre a lista e a escolha, nada é entregue e a lista nova é mostrada",
    async (_, mudar) => {
      const documentos = alteracoes(3);
      const { caso, enviadas, documentosEnviados, sessoes } = montar({ documentos });
      await caso.execute({ telefone: FONE, texto: "1" });
      await caso.execute({ telefone: FONE, texto: "2" });
      const antes = sessoes.get(CHAVE);

      mudar(documentos);
      await caso.execute({ telefone: FONE, texto: "1" });

      expect(documentosEnviados).toEqual([]);
      expect(enviadas.at(-1)?.texto).toContain("atualizada");
      expect(enviadas.at(-1)?.texto).toContain(documentos.length === 4 ? "4 - " : "2 - ");
      expect(sessoes.get(CHAVE)).not.toEqual(antes);

      // Com a lista nova já exibida, a mesma escolha passa a valer.
      await caso.execute({ telefone: FONE, texto: "1" });
      expect(documentosEnviados).toHaveLength(1);
    },
  );
});

describe("ReceberMensagem — fallback para a recepção (#50)", () => {
  const TEL = "11900000000";
  const dizer = (caso: ReturnType<typeof montar>["caso"], texto: string) =>
    caso.execute({ telefone: TEL, texto });

  it.each(["oi", "sim"])(
    "pedido de atendente fora do fluxo (%s antes) transfere pra recepção",
    async (antes) => {
      const { caso, abertos, sessoes } = montar({ contato: null });
      await dizer(caso, "oi");
      if (antes === "sim") await dizer(caso, "sim");
      await dizer(caso, "Quero falar com um ATENDENTE");
      expect(abertos).toHaveLength(1);
      expect(abertos[0]).toMatchObject({ clienteId: null, setor: "recepcao" });
      expect(sessoes.has(TEL)).toBe(false);
    },
  );

  it("pedido de atendente na primeira mensagem já vai à recepção, sem a pergunta", async () => {
    const { caso, enviadas, abertos } = montar({ contato: null });
    await dizer(caso, "quero falar com uma pessoa, por favor");
    expect(abertos).toHaveLength(1);
    expect(enviadas[0].texto).toContain("recepção");
  });

  it.each([
    "preciso de suporte",
    "quero falar com o contador",
    "Conversar com a contadora",
    "preciso de ajuda",
    "quero falar com um funcionário",
    "tenho uma dúvida",
    "quero falar com humano",
    "preciso da recepção",
    "chama o recepcionista",
    "quero falar com alguém",
    "quero falar com gente",
  ])("'%s' também é pedido de atendente", async (frase) => {
    const { caso, abertos } = montar({ contato: null });
    await dizer(caso, frase);
    expect(abertos).toHaveLength(1);
  });

  it("'menu' recomeça o fluxo e zera os contadores de respostas inválidas", async () => {
    const { caso, sessoes } = montar({ contato: null });
    for (const t of ["oi", "sim", "123", "menu"]) await dizer(caso, t);
    expect(sessoes.get(TEL)).toEqual({ etapa: "ja_cliente", invalidos: 0 });
  });

  it.each(["sou pessoa física", "preciso de atendimento fiscal"])(
    "frase comum sem pedido de atendente ('%s') segue o fluxo",
    async (frase) => {
      const { caso, abertos, sessoes } = montar({ contato: null });
      for (const t of ["oi", frase]) await dizer(caso, t);
      expect(abertos).toHaveLength(0);
      expect(sessoes.get(TEL)).toEqual({ etapa: "ja_cliente", invalidos: 1 });
    },
  );

  it("CNPJ cadastrado digitado só com dígitos também é reconhecido", async () => {
    const { caso, abertos } = montar({ contato: null });
    for (const t of ["oi", "sim", "90000001000129"]) await dizer(caso, t);
    expect(abertos).toHaveLength(1);
  });

  it("'menu' continua recomeçando, mesmo com palavra-chave no texto", async () => {
    const { caso, abertos } = montar({ contato: null });
    for (const t of ["oi", "menu"]) await dizer(caso, t);
    expect(abertos).toHaveLength(0);
  });

  it("CNPJ não cadastrado permite uma nova tentativa, sem transferir", async () => {
    const { caso, enviadas, abertos, sessoes } = montar({ contato: null });
    for (const t of ["oi", "sim", CNPJ_DESCONHECIDO]) await dizer(caso, t);
    expect(enviadas[2].texto).toContain("Não encontramos esse CNPJ");
    expect(abertos).toHaveLength(0);
    expect(sessoes.get(TEL)).toEqual({ etapa: "cnpj_nova_tentativa", invalidos: 0 });
  });

  it("segundo CNPJ não cadastrado transfere pra recepção com aviso", async () => {
    const { caso, enviadas, abertos, sessoes } = montar({ contato: null });
    for (const t of ["oi", "sim", CNPJ_DESCONHECIDO, "00.000.000/0001-91"]) await dizer(caso, t);
    expect(enviadas[3].texto).toContain("Não encontramos esse CNPJ");
    expect(enviadas[3].texto).toContain("recepção");
    expect(abertos).toHaveLength(1);
    expect(abertos[0].mensagens[1].texto).toBe(enviadas[3].texto);
    expect(sessoes.has(TEL)).toBe(false);
  });

  it("respostas fora de sim/não seguidas levam à recepção na terceira", async () => {
    const { caso, abertos, sessoes } = montar({ contato: null });
    for (const t of ["oi", "talvez", "hmm"]) await dizer(caso, t);
    expect(abertos).toHaveLength(0);
    expect(sessoes.get(TEL)).toEqual({ etapa: "ja_cliente", invalidos: 2 });
    await dizer(caso, "sei la");
    expect(abertos).toHaveLength(1);
    expect(sessoes.has(TEL)).toBe(false);
  });

  it("CNPJs inválidos seguidos levam à recepção no terceiro", async () => {
    const { caso, abertos, sessoes } = montar({ contato: null });
    for (const t of ["oi", "sim", "123", "456"]) await dizer(caso, t);
    expect(abertos).toHaveLength(0);
    expect(sessoes.get(TEL)).toEqual({ etapa: "cnpj", invalidos: 2 });
    await dizer(caso, "789");
    expect(abertos).toHaveLength(1);
    expect(sessoes.has(TEL)).toBe(false);
  });

  it("CNPJ inválido não gasta a nova tentativa", async () => {
    const { caso, abertos, sessoes } = montar({ contato: null });
    for (const t of ["oi", "sim", CNPJ_DESCONHECIDO, "123"]) await dizer(caso, t);
    expect(abertos).toHaveLength(0);
    expect(sessoes.get(TEL)).toEqual({ etapa: "cnpj_nova_tentativa", invalidos: 1 });
  });

  it("CNPJ cadastrado na nova tentativa vai à recepção com o aviso padrão", async () => {
    const { caso, enviadas, abertos } = montar({ contato: null });
    for (const t of ["oi", "sim", CNPJ_DESCONHECIDO, CNPJ_CADASTRADO]) await dizer(caso, t);
    expect(abertos).toHaveLength(1);
    expect(enviadas[3].texto).not.toContain("Não encontramos esse CNPJ");
  });

  it("falha ao consultar o CNPJ devolve o erro e mantém a sessão", async () => {
    const { caso, sessoes } = montar({ contato: null, cnpjFalha: true });
    for (const t of ["oi", "sim"]) await dizer(caso, t);
    expect((await dizer(caso, CNPJ_DESCONHECIDO)).ok).toBe(false);
    expect(sessoes.get(TEL)).toEqual({ etapa: "cnpj", invalidos: 0 });
  });
});

describe("ReceberMensagem — opção falar com atendente (#46)", () => {
  const TEL = "5511912345678";
  const pedir = (caso: ReturnType<typeof montar>["caso"]) =>
    caso.execute({ telefone: TEL, texto: " 5 " });

  it("abre Atendimento na recepção já vinculado ao Cliente, com as Mensagens da conversa", async () => {
    const { caso, abertos } = montar();
    expect((await pedir(caso)).ok).toBe(true);
    expect(abertos).toHaveLength(1);
    expect(abertos[0]).toMatchObject({
      telefone: TEL,
      chave: "11912345678",
      clienteId: "cliente-1",
      setor: "recepcao",
    });
    expect(abertos[0].mensagens.map((m) => m.autor)).toEqual(["contato", "ura"]);
  });

  it("registra o rótulo da opção como Mensagem do contato, não o dígito digitado", async () => {
    const { caso, abertos } = montar();
    await pedir(caso);
    expect(abertos[0].mensagens[0]).toEqual({ autor: "contato", texto: "Falar com atendente" });
  });

  it("avisa que vai à recepção, sem o stub 'em construção'", async () => {
    const { caso, enviadas } = montar();
    await pedir(caso);
    expect(enviadas).toHaveLength(2);
    expect(enviadas[0].texto).toContain("recepção");
    expect(enviadas[0].texto).not.toContain("em construção");
  });

  it("manda o aviso para aguardar depois do aviso da recepção", async () => {
    const { caso, enviadas } = montar();
    await pedir(caso);
    expect(enviadas.map((e) => e.texto)).toEqual([
      expect.stringContaining("recepção"),
      "Aguarde, já vamos atendê-lo.",
    ]);
  });

  it.each(["05", "5.0", "0x5", "5e0"])(
    "formato numérico %p não abre Atendimento",
    async (texto) => {
      const { caso, abertos } = montar();
      await caso.execute({ telefone: TEL, texto });
      expect(abertos).toHaveLength(0);
    },
  );

  it("limpa a sessão que sobrou ao abrir o Atendimento", async () => {
    const { caso, sessoes } = montar();
    sessoes.set("11912345678", { etapa: "ja_cliente", invalidos: 1 });
    await pedir(caso);
    expect(sessoes.size).toBe(0);
  });

  it("a opção de atendente é a última do menu enviado", async () => {
    const { caso, enviadas } = montar();
    await caso.execute({ telefone: TEL, texto: "oi" });
    const linhas = enviadas[0].texto.split("\n");
    expect(linhas[linhas.length - 1]).toBe("5 - Falar com atendente");
  });

  it("o aviso da opção não repete o dos outros caminhos para a recepção", async () => {
    const { caso, enviadas } = montar();
    await pedir(caso);
    expect(enviadas[0].texto).toMatch(/^Certo!/);
    expect(enviadas[0].texto).not.toContain("Não encontramos");
  });

  it("falha ao abrir o Atendimento devolve o erro", async () => {
    const { caso } = montar({ aberturaFalha: true });
    expect((await pedir(caso)).ok).toBe(false);
  });

  it("falha do envio do aviso não abre Atendimento (a reentrega não duplica)", async () => {
    const { caso, abertos } = montar({ envioFalha: true });
    expect((await pedir(caso)).ok).toBe(false);
    expect(abertos).toHaveLength(0);
  });
});

describe("ReceberMensagem — resumo e CNPJ do Atendimento aberto pela URA (#46)", () => {
  const TEL_NOVO = "5511900000000";
  const dizerNovo = (caso: ReturnType<typeof montar>["caso"], texto: string) =>
    caso.execute({ telefone: TEL_NOVO, texto });

  it("opção do menu: resumo do pedido, sem CNPJ informado", async () => {
    const { caso, abertos } = montar();
    await caso.execute({ telefone: "5511912345678", texto: "5" });
    expect(abertos[0].resumo).toBe("Cliente pediu a recepção pelo menu da URA.");
    expect(abertos[0].cnpjInformado).toBeUndefined();
  });

  it("CNPJ de Cliente cadastrado: leva o CNPJ normalizado para o banco ligar ao Cliente", async () => {
    const { caso, abertos } = montar({ contato: null });
    for (const t of ["oi", "sim", CNPJ_CADASTRADO]) await dizerNovo(caso, t);
    expect(abertos[0].clienteId).toBeNull();
    expect(abertos[0].cnpjInformado).toBe(normalizarCnpj(CNPJ_CADASTRADO));
    expect(abertos[0].resumo).toContain("não consta nos contatos do Cliente do CNPJ informado");
  });

  it("CNPJ que não existe no sistema: provável cliente novo, com o CNPJ da segunda tentativa", async () => {
    const { caso, abertos } = montar({ contato: null });
    for (const t of ["oi", "sim", CNPJ_DESCONHECIDO, CNPJ_DESCONHECIDO]) await dizerNovo(caso, t);
    expect(abertos).toHaveLength(1);
    expect(abertos[0].cnpjInformado).toBe(normalizarCnpj(CNPJ_DESCONHECIDO));
    expect(abertos[0].resumo).toContain("provável cliente novo");
  });

  it.each([
    ["pedido de atendente", ["atendente"], "pediu um atendente"],
    ["resposta 'não' a já ser cliente", ["oi", "não"], "disse não ser cliente"],
    ["respostas inválidas seguidas", ["oi", "x", "x", "x"], "respostas inválidas seguidas"],
  ])("%s: resumo sem CNPJ informado", async (_, falas, trecho) => {
    const { caso, abertos } = montar({ contato: null });
    for (const t of falas) await dizerNovo(caso, t);
    expect(abertos[0].resumo).toContain(trecho);
    expect(abertos[0].cnpjInformado).toBeUndefined();
  });
});
