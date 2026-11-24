import type { ComunicacaoProativa } from "@/modules/atendimento/application/mensagens/comunicacao-proativa";
import type { DestinoDeEnvio } from "@/modules/atendimento/application/ports/out/destinos-de-envio.provider";
import type { EmailParaEnvio } from "@/modules/atendimento/application/ports/out/envio-email.provider";
import { EnvioMensagemFalsoGateway } from "@/modules/atendimento/infra/gateways/envio-mensagem-falso.gateway";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { EntregarComunicacaoPorCanais } from "./entregar-comunicacao-por-canais.use-case";
import { EnviarComunicacaoProativa } from "./enviar-comunicacao-proativa.use-case";

const agora = new Date("2026-10-05T12:00:00Z");
const cliente = { empresa: "Cliente Exemplo Ltda" };

const lembrete: ComunicacaoProativa = {
  tipo: "lembrete_documento_obrigatorio",
  contato: "Cliente Exemplo Ltda",
  empresa: "Cliente Exemplo Ltda",
};
const guia: ComunicacaoProativa = {
  tipo: "envio_guia_parcelamento",
  contato: "Cliente Exemplo Ltda",
  empresa: "Cliente Exemplo Ltda",
  parcela: "10/2026",
  guia: { url: "https://storage.test/guia.pdf", nomeArquivo: "guia.pdf" },
};

function destino(extra: Partial<DestinoDeEnvio> = {}): DestinoDeEnvio {
  return {
    contatoNome: "Ana Exemplo",
    telefone: "5511912345678",
    email: null,
    canal: "whatsapp",
    ultimaMensagemDoContatoEm: null,
    motivoInvalido: null,
    ...extra,
  };
}

function montar(opcoes: { falhasWhatsapp?: Record<string, number>; emailFalha?: boolean } = {}) {
  const envio = new EnvioMensagemFalsoGateway(opcoes.falhasWhatsapp);
  const emails: EmailParaEnvio[] = [];
  const entrega = new EntregarComunicacaoPorCanais(
    new EnviarComunicacaoProativa(envio, 1, 0),
    {
      enviar: async (email) => {
        if (opcoes.emailFalha) return err(new ServicoExternoError("SMTP recusou."));
        emails.push(email);
        return ok(undefined);
      },
    },
    0,
  );
  return { entrega, envio, emails };
}

describe("EntregarComunicacaoPorCanais", () => {
  it("canal WhatsApp: envia ao telefone do Destino, chamando o Contato do Destino pelo nome", async () => {
    const { entrega, envio } = montar();
    const resultado = await entrega.execute({
      cliente,
      destinos: [destino()],
      comunicacao: lembrete,
      agora,
    });
    expect(resultado).toEqual(ok({ entregues: 1, ocorrencias: [] }));
    expect(envio.templatesEnviados).toMatchObject([
      {
        nome: "lembrete_documento_obrigatorio",
        telefone: "5511912345678",
        variaveis: ["Ana Exemplo", "Cliente Exemplo Ltda"],
      },
    ]);
  });

  it("canal e-mail: manda e-mail ao endereço do Destino e não usa WhatsApp", async () => {
    const { entrega, envio, emails } = montar();
    const resultado = await entrega.execute({
      cliente,
      destinos: [destino({ canal: "email", telefone: null, email: "ana@exemplo.test" })],
      comunicacao: lembrete,
      agora,
    });
    expect(resultado).toEqual(ok({ entregues: 1, ocorrencias: [] }));
    expect(envio.requisicoes).toHaveLength(0);
    expect(emails).toMatchObject([{ para: "ana@exemplo.test" }]);
  });

  it("'ambos': tenta cada canal, e a falha de um não impede o outro", async () => {
    const { entrega, emails } = montar({ falhasWhatsapp: { "5511912345678": 131026 } });
    const resultado = await entrega.execute({
      cliente,
      destinos: [destino({ canal: "whatsapp_e_email", email: "ana@exemplo.test" })],
      comunicacao: lembrete,
      agora,
    });
    expect(emails).toHaveLength(1);
    expect(resultado.ok && resultado.value.entregues).toBe(1);
    expect(resultado.ok && resultado.value.ocorrencias).toMatchObject([
      { tipo: "falha_envio", mensagem: expect.stringContaining("WhatsApp") },
    ]);
  });

  it("guia entregue por um canal só no 'ambos': acrescenta a entrega parcial", async () => {
    const { entrega } = montar({ emailFalha: true });
    const resultado = await entrega.execute({
      cliente,
      destinos: [destino({ canal: "whatsapp_e_email", email: "ana@exemplo.test" })],
      comunicacao: guia,
      agora,
    });
    expect(resultado.ok && resultado.value.entregues).toBe(1);
    expect(resultado.ok && resultado.value.ocorrencias.map((o) => o.tipo)).toEqual([
      "falha_envio",
      "entrega_parcial",
    ]);
  });

  it("lembrete entregue por um canal só não gera entrega parcial (recorrente)", async () => {
    const { entrega } = montar({ emailFalha: true });
    const resultado = await entrega.execute({
      cliente,
      destinos: [destino({ canal: "whatsapp_e_email", email: "ana@exemplo.test" })],
      comunicacao: lembrete,
      agora,
    });
    expect(resultado.ok && resultado.value.ocorrencias.map((o) => o.tipo)).toEqual(["falha_envio"]);
  });

  it("vários Destinos: cada Contato recebe, com o próprio nome e a própria janela de 24h", async () => {
    const { entrega, envio } = montar();
    const resultado = await entrega.execute({
      cliente,
      destinos: [
        destino({ ultimaMensagemDoContatoEm: new Date("2026-10-05T08:00:00Z") }),
        destino({ contatoNome: "Bia Exemplo", telefone: "5511987654321" }),
      ],
      comunicacao: lembrete,
      agora,
    });
    expect(resultado.ok && resultado.value.entregues).toBe(2);
    expect(envio.enviadas).toHaveLength(1);
    expect(envio.templatesEnviados).toMatchObject([
      { telefone: "5511987654321", variaveis: ["Bia Exemplo", "Cliente Exemplo Ltda"] },
    ]);
  });

  it("Destino inválido ao lado de um válido: o válido recebe, o inválido vira falha_envio com o Contato e a guia ganha entrega parcial", async () => {
    const { entrega, envio, emails } = montar();
    const resultado = await entrega.execute({
      cliente,
      destinos: [
        destino(),
        destino({
          contatoNome: "Caio Exemplo",
          canal: "email",
          telefone: null,
          email: null,
          motivoInvalido: "sem_email",
        }),
      ],
      comunicacao: guia,
      agora,
    });
    expect(resultado.ok && resultado.value.entregues).toBe(1);
    expect(resultado.ok && resultado.value.ocorrencias).toEqual([
      {
        tipo: "falha_envio",
        mensagem: "Caio Exemplo: Destino inválido, o Contato não tem mais e-mail.",
      },
      expect.objectContaining({ tipo: "entrega_parcial" }),
    ]);
    expect(envio.requisicoes).toHaveLength(1);
    expect(emails).toHaveLength(0);
  });

  it("Destino inválido que ainda tem outro canal no Contato não recebe por esse canal", async () => {
    const { entrega, envio } = montar();
    const resultado = await entrega.execute({
      cliente,
      destinos: [destino({ canal: "whatsapp_e_email", email: null, motivoInvalido: "sem_email" })],
      comunicacao: lembrete,
      agora,
    });
    expect(resultado.ok && resultado.value.entregues).toBe(0);
    expect(envio.requisicoes).toHaveLength(0);
  });

  it("sem Destino: erro, nada é enviado e o chamador que esqueceu a triagem não perde o envio em silêncio", async () => {
    const { entrega, envio, emails } = montar();
    const resultado = await entrega.execute({
      cliente,
      destinos: [],
      comunicacao: lembrete,
      agora,
    });
    expect(resultado).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(envio.requisicoes).toHaveLength(0);
    expect(emails).toHaveLength(0);
  });
});
