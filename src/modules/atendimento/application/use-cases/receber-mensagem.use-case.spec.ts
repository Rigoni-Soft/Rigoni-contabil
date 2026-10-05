import type {
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

const ana: ContatoIdentificado = { nome: "Ana", empresa: "Padaria Pão Quente", padrao: true };

function montar(opcoes: { contato?: ContatoIdentificado | null; envioFalha?: boolean } = {}) {
  const buscados: string[] = [];
  const enviadas: MensagemEnviada[] = [];
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
  };
  return { caso: new ReceberMensagem(identificacao, envio), buscados, enviadas };
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

  it.each(["1", "2", "3", "4", "5", " 3 "])(
    "opção %p do menu responde em construção",
    async (texto) => {
      const { caso, enviadas } = montar();
      const r = await caso.execute({ telefone: "11912345678", texto });
      expect(r.ok).toBe(true);
      expect(enviadas[0].texto).toContain("em construção");
    },
  );

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
      },
    );
    const r = await caso.execute({ telefone: "11912345678", texto: "oi" });
    expect(r.ok).toBe(false);
    expect(enviadas).toHaveLength(0);
  });
});
