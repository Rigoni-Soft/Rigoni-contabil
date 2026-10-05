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
  ContatoIdentificado,
  IdentificacaoContatoPort,
} from "@/modules/atendimento/application/ports/out/identificacao-contato.provider";
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
const ALTERACAO_2020: DocumentoContratual = {
  tipo: "alteracao",
  data: "2020-03-12",
  caminho: "c1/alt-2020.pdf",
};
const ALTERACAO_2022: DocumentoContratual = {
  tipo: "alteracao",
  data: "2022-11-01",
  caminho: "c1/alt-2022.docx",
};

function montar(
  opcoes: {
    contato?: ContatoIdentificado | null;
    envioFalha?: boolean;
    documentos?: DocumentoContratual[];
    listagemFalha?: boolean;
  } = {},
) {
  const buscados: string[] = [];
  const enviadas: MensagemEnviada[] = [];
  const documentosEnviados: DocumentoEnviado[] = [];
  const listados: string[] = [];
  const identificacao: IdentificacaoContatoPort = {
    identificar: async (telefone): Promise<Result<ContatoIdentificado | null, AppError>> => {
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
  return {
    caso: new ReceberMensagem(identificacao, envio, documentos),
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

  it("número desconhecido recebe aviso sem menu", async () => {
    const { caso, enviadas } = montar({ contato: null });
    const r = await caso.execute({ telefone: "11900000000", texto: "oi" });
    expect(r.ok).toBe(true);
    expect(enviadas[0].texto).toContain("Não identificamos");
    expect(enviadas[0].texto).not.toContain("1 -");
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
    );
    const r = await caso.execute({ telefone: "11912345678", texto: "oi" });
    expect(r.ok).toBe(false);
    expect(enviadas).toHaveLength(0);
  });
});

describe("ReceberMensagem — contrato social e alterações (opção 1)", () => {
  it("com um único documento, entrega o arquivo direto, do Cliente identificado", async () => {
    const { caso, listados, documentosEnviados, enviadas } = montar({ documentos: [CONTRATO] });
    const r = await caso.execute({ telefone: "5511912345678", texto: "1" });
    expect(r.ok).toBe(true);
    expect(listados).toEqual(["cliente-1"]);
    expect(documentosEnviados).toEqual([
      {
        telefone: "5511912345678",
        url: "https://storage.test/c1/contrato.pdf?token=x",
        nomeArquivo: "Contrato social.pdf",
      },
    ]);
    expect(enviadas).toHaveLength(0);
  });

  it("com mais de um documento, lista as opções por data sem enviar arquivo", async () => {
    const { caso, documentosEnviados, enviadas } = montar({
      documentos: [CONTRATO, ALTERACAO_2020, ALTERACAO_2022],
    });
    await caso.execute({ telefone: "11912345678", texto: "1" });
    expect(documentosEnviados).toHaveLength(0);
    expect(enviadas[0].texto).toContain("1.1 - Contrato social");
    expect(enviadas[0].texto).toContain("1.2 - Alteração de 12/03/2020");
    expect(enviadas[0].texto).toContain("1.3 - Alteração de 01/11/2022");
  });

  it("escolher '1.3' entrega a alteração correspondente", async () => {
    const { caso, documentosEnviados } = montar({
      documentos: [CONTRATO, ALTERACAO_2020, ALTERACAO_2022],
    });
    await caso.execute({ telefone: "11912345678", texto: " 1.3 " });
    expect(documentosEnviados).toEqual([
      {
        telefone: "11912345678",
        url: "https://storage.test/c1/alt-2022.docx?token=x",
        nomeArquivo: "Alteração de 01/11/2022.docx",
      },
    ]);
  });

  it("escolha fora da lista reapresenta as opções", async () => {
    const { caso, documentosEnviados, enviadas } = montar({
      documentos: [CONTRATO, ALTERACAO_2020],
    });
    await caso.execute({ telefone: "11912345678", texto: "1.9" });
    expect(documentosEnviados).toHaveLength(0);
    expect(enviadas[0].texto).toContain("1.2 - Alteração de 12/03/2020");
  });

  it("com um único documento, '1.7' reapresenta a lista em vez de entregar", async () => {
    const { caso, documentosEnviados, enviadas } = montar({ documentos: [CONTRATO] });
    await caso.execute({ telefone: "11912345678", texto: "1.7" });
    expect(documentosEnviados).toHaveLength(0);
    expect(enviadas[0].texto).toContain("1.1 - Contrato social");
  });

  it("caminho sem extensão não corrompe o nome do arquivo", async () => {
    const { caso, documentosEnviados } = montar({
      documentos: [{ tipo: "contrato", data: null, caminho: "c1.v2/contrato" }],
    });
    await caso.execute({ telefone: "11912345678", texto: "1" });
    expect(documentosEnviados[0].nomeArquivo).toBe("Contrato social");
  });

  it("Cliente sem documento cadastrado recebe aviso", async () => {
    const { caso, documentosEnviados, enviadas } = montar({ documentos: [] });
    await caso.execute({ telefone: "11912345678", texto: "1" });
    expect(documentosEnviados).toHaveLength(0);
    expect(enviadas[0].texto).toContain("Não encontramos");
  });

  it("falha ao listar os documentos propaga o erro sem enviar nada", async () => {
    const { caso, enviadas, documentosEnviados } = montar({ listagemFalha: true });
    const r = await caso.execute({ telefone: "11912345678", texto: "1" });
    expect(r.ok).toBe(false);
    expect(enviadas).toHaveLength(0);
    expect(documentosEnviados).toHaveLength(0);
  });

  it("falha do adapter ao enviar o documento vira erro de serviço externo", async () => {
    const { caso } = montar({ documentos: [CONTRATO], envioFalha: true });
    const r = await caso.execute({ telefone: "11912345678", texto: "1" });
    expect(r).toEqual({ ok: false, error: expect.any(ServicoExternoError) });
  });

  it("número desconhecido não acessa documento algum", async () => {
    const { caso, listados } = montar({ contato: null });
    await caso.execute({ telefone: "11900000000", texto: "1" });
    expect(listados).toHaveLength(0);
  });
});
