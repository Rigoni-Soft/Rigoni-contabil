/**
 * Integração handler de webhook ↔ caso de uso (testes.md, seção 3), com o
 * remetente simulado: a composição (`main`) é trocada por fakes em memória.
 */
import { ReceberMensagem } from "@/modules/atendimento/application/use-cases/receber-mensagem.use-case";
import { EnvioMensagemFalsoGateway } from "@/modules/atendimento/infra/gateways/envio-mensagem-falso.gateway";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { POST } from "./mensagens.webhook";

const envio = new EnvioMensagemFalsoGateway();
let identificacao: ConstructorParameters<typeof ReceberMensagem>[0];

jest.mock("@/main/atendimento.factory", () => ({
  makeReceberMensagem: () => new ReceberMensagem(identificacao, envio),
}));

const requisicao = (corpo: string) =>
  new Request("http://localhost/api/webhooks/mensagens", { method: "POST", body: corpo });

beforeEach(() => {
  envio.enviadas.length = 0;
  identificacao = {
    identificar: async () => ok({ nome: "Ana", empresa: "Padaria", padrao: true }),
  };
  jest.spyOn(console, "info").mockImplementation(() => undefined);
});

describe("POST /api/webhooks/mensagens", () => {
  it("200 e responde com saudação + menu pro contato reconhecido", async () => {
    const r = await POST(requisicao(JSON.stringify({ telefone: "5511912345678", texto: "oi" })));
    expect(r.status).toBe(200);
    expect(envio.enviadas[0].texto).toContain("Olá, Ana");
  });

  it.each([
    "isso nao e json",
    JSON.stringify({ telefone: "5511912345678" }),
    JSON.stringify({ telefone: "abc", texto: "oi" }),
  ])("400 pra corpo inválido %p, sem enviar nada", async (corpo) => {
    const r = await POST(requisicao(corpo));
    expect(r.status).toBe(400);
    expect(envio.enviadas).toHaveLength(0);
  });

  it("502 quando a identificação falha (remetente tenta de novo)", async () => {
    identificacao = { identificar: async () => err(new ServicoExternoError("banco")) };
    const r = await POST(requisicao(JSON.stringify({ telefone: "11912345678", texto: "oi" })));
    expect(r.status).toBe(502);
  });
});
