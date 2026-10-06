import type {
  AberturaAtendimento,
  AbrirAtendimentoPort,
  NovaMensagem,
} from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type { AnexarMensagemAtendimentoPort } from "@/modules/atendimento/application/ports/in/anexar-mensagem-atendimento.provider";
import type {
  DocumentoContratual,
  DocumentosContratuaisPort,
} from "@/modules/atendimento/application/ports/out/documentos-contratuais.provider";
import type {
  DocumentoEnviado,
  EnvioMensagemPort,
  MensagemEnviada,
} from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type {
  ContatoAmbiguo,
  ContatoIdentificado,
  IdentificacaoContatoPort,
} from "@/modules/atendimento/application/ports/out/identificacao-contato.provider";
import type {
  SessaoAtendimento,
  SessaoAtendimentoPort,
} from "@/modules/atendimento/application/ports/out/sessao-atendimento.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { ReceberMensagem } from "./receber-mensagem.use-case";

const ana: ContatoIdentificado = {
  clienteId: "cliente-1",
  nome: "Ana",
  empresa: "Padaria Pão Quente",
  padrao: true,
};

const CONTRATO: DocumentoContratual = {
  tipo: "contrato",
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
  };
  const envio: EnvioMensagemPort = {
    enviar: async (m) => {
      if (opcoes.envioFalha) throw new Error("rede");
      enviadas.push(m);
      return ok(undefined);
    },
    enviarDocumento: async (d) => {
      if (opcoes.envioFalha) throw new Error("rede");
      documentosEnviados.push(d);
      return ok(undefined);
    },
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
  const mensagens: AnexarMensagemAtendimentoPort = {
    execute: async ({ mensagem }) => {
      if (!opcoes.emAndamento) return ok({ anexada: false });
      anexadas.push(mensagem);
      return ok({ anexada: true });
    },
  };
  const atendimentos: AbrirAtendimentoPort = {
    execute: async (a) => {
      if (opcoes.aberturaFalha) return err(new ServicoExternoError("banco"));
      abertos.push(a);
      return ok({ id: "at-1", funcionarioId: null });
    },
  };
  return {
    anexadas,
    abertos,
    caso: new ReceberMensagem(identificacao, envio, documentos, sessao, atendimentos, mensagens),
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

  it.each(["2", "3", "4", "5", " 3 "])("opção %p do menu responde em construção", async (texto) => {
    const { caso, enviadas } = montar();
    const r = await caso.execute({ telefone: "11912345678", texto });
    expect(r.ok).toBe(true);
    expect(enviadas[0].texto).toContain("em construção");
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
      { identificar: async () => err(new ServicoExternoError("banco")) },
      {
        enviar: async (m) => {
          enviadas.push(m);
          return ok(undefined);
        },
        enviarDocumento: async () => ok(undefined),
      },
      { listar: async () => ok([]), linkTemporario: async () => ok("x") },
      {
        obter: async () => ok(null),
        salvar: async () => ok(undefined),
        limpar: async () => ok(undefined),
      },
      { execute: async () => ok({ id: "at-1", funcionarioId: null }) },
      { execute: async () => ok({ anexada: false }) },
    );
    const r = await caso.execute({ telefone: "11912345678", texto: "oi" });
    expect(r.ok).toBe(false);
    expect(enviadas).toHaveLength(0);
  });
});

function alteracoes(quantidade: number): DocumentoContratual[] {
  // Datas crescentes: a alteração i é mais recente que a i-1.
  return Array.from({ length: quantidade }, (_, i) => ({
    tipo: "alteracao" as const,
    data: `2020-${String(i + 1).padStart(2, "0")}-15`,
    caminho: `c1/alt-${i + 1}.pdf`,
  }));
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
    expect(nomes(documentosEnviados)).toEqual(["Alteração de 15/01/2020.pdf"]);
    expect(sessoes.size).toBe(0);
  });

  it("alterações sem nenhuma cadastrada avisa", async () => {
    const { caso, documentosEnviados, enviadas } = montar({ documentos: [CONTRATO] });
    await caso.execute({ telefone: FONE, texto: "1" });
    await caso.execute({ telefone: FONE, texto: "2" });
    expect(documentosEnviados).toHaveLength(0);
    expect(enviadas[1].texto).toContain("Não encontramos");
  });

  it("várias alterações: lista da mais recente à mais antiga e envia a escolhida", async () => {
    const { caso, documentosEnviados, enviadas } = montar({
      documentos: [CONTRATO, ...alteracoes(3)],
    });
    await caso.execute({ telefone: FONE, texto: "1" });
    await caso.execute({ telefone: FONE, texto: "2" });
    const lista = enviadas[1].texto;
    expect(lista.indexOf("15/03/2020")).toBeLessThan(lista.indexOf("15/02/2020"));
    expect(lista.indexOf("15/02/2020")).toBeLessThan(lista.indexOf("15/01/2020"));
    await caso.execute({ telefone: FONE, texto: "1" });
    expect(nomes(documentosEnviados)).toEqual(["Alteração de 15/03/2020.pdf"]);
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
    expect(nomes(documentosEnviados)).toEqual(["Alteração de 15/01/2020.pdf"]);
  });

  it("'mais' na última página e número fora da lista reapresentam a página", async () => {
    const { caso, documentosEnviados, enviadas } = montar({ documentos: alteracoes(3) });
    await caso.execute({ telefone: FONE, texto: "1" });
    await caso.execute({ telefone: FONE, texto: "2" });
    await caso.execute({ telefone: FONE, texto: "mais" });
    await caso.execute({ telefone: FONE, texto: "9" });
    expect(documentosEnviados).toHaveLength(0);
    expect(enviadas).toHaveLength(4);
    expect(enviadas[3].texto).toContain("15/03/2020");
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
      "Alteração de 15/02/2020.pdf",
    ]);
  });

  it("ambos com uma única alteração envia os dois direto", async () => {
    const { caso, documentosEnviados } = montar({ documentos: [CONTRATO, ...alteracoes(1)] });
    await caso.execute({ telefone: FONE, texto: "1" });
    await caso.execute({ telefone: FONE, texto: "3" });
    expect(nomes(documentosEnviados)).toEqual([
      "Contrato social.pdf",
      "Alteração de 15/01/2020.pdf",
    ]);
  });

  it("ambos sem contrato cadastrado avisa e envia a alteração escolhida", async () => {
    const { caso, documentosEnviados, enviadas } = montar({ documentos: alteracoes(3) });
    await caso.execute({ telefone: FONE, texto: "1" });
    await caso.execute({ telefone: FONE, texto: "3" });
    await caso.execute({ telefone: FONE, texto: "1" });
    expect(enviadas.at(-1)?.texto).toContain("Não encontramos o contrato");
    expect(nomes(documentosEnviados)).toEqual(["Alteração de 15/03/2020.pdf"]);
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
    expect(sessoes.get("11900000000")).toEqual({ etapa: "ja_cliente" });
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
    expect(sessoes.get(TEL)).toEqual({ etapa: "ja_cliente" });
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
    expect(sessoes.get(TEL)).toEqual({ etapa: "ja_cliente" });
  });

  it("resposta positiva pede o CNPJ", async () => {
    const { caso, enviadas, sessoes } = montar({ contato: null });
    await dizer(caso, "oi");
    await dizer(caso, "sim");
    expect(enviadas[1].texto).toContain("CNPJ");
    expect(sessoes.get(TEL)).toEqual({ etapa: "cnpj" });
  });

  it("CNPJ inválido pede de novo, sem transferir", async () => {
    const { caso, enviadas, sessoes } = montar({ contato: null });
    for (const t of ["oi", "sim", "123"]) await dizer(caso, t);
    expect(enviadas[2].texto).toContain("CNPJ");
    expect(sessoes.get(TEL)).toEqual({ etapa: "cnpj" });
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
    expect(sessoes.get(TEL)).toEqual({ etapa: "ja_cliente" });
  });

  it("a transferência abre Atendimento na recepção com as Mensagens da conversa", async () => {
    const { caso, abertos } = montar({ contato: null });
    for (const t of ["oi", "sim", "90.000.001/0001-29"]) await dizer(caso, t);
    expect(abertos).toHaveLength(1);
    expect(abertos[0]).toMatchObject({ telefone: TEL, clienteId: null, setor: "recepcao" });
    expect(abertos[0].mensagens.map((m) => m.autor)).toEqual(["contato", "ura"]);
    expect(abertos[0].mensagens[0].texto).toBe("90.000.001/0001-29");
  });

  it("falha ao abrir o Atendimento devolve o erro e mantém a sessão", async () => {
    const { caso, sessoes } = montar({ contato: null, aberturaFalha: true });
    await dizer(caso, "oi");
    expect((await dizer(caso, "não")).ok).toBe(false);
    expect(sessoes.get(TEL)).toEqual({ etapa: "ja_cliente" });
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

describe("ReceberMensagem — mesmo número em mais de um Cliente (PR #76, B2)", () => {
  it.each(["oi", "1", "menu", "3"])(
    "'%s' vai pra recepção, sem menu nem documento, mesmo havendo contratos",
    async (texto) => {
      const { caso, enviadas, documentosEnviados, listados, sessoes, abertos } = montar({
        contato: "ambiguo",
        documentos: [CONTRATO],
      });
      sessoes.set(CHAVE, { etapa: "tipo_documento" });

      expect((await caso.execute({ telefone: FONE, texto })).ok).toBe(true);

      expect(enviadas).toHaveLength(1);
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

describe("ReceberMensagem — lista de alterações mudou com a sessão aberta (PR #76, I2)", () => {
  it.each([
    ["uma alteração é incluída", (docs: DocumentoContratual[]) => docs.push(alteracoes(4)[3])],
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
