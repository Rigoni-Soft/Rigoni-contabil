import { createHmac } from "node:crypto";

import type { APIRequestContext } from "@playwright/test";

import { expect, test } from "./fixtures";
import { adminLocal } from "./support/admin-local";

// "Falar com atendente" na URA abre a lista de Setores. O webhook é chamado com a
// assinatura HMAC do segredo de desenvolvimento e o resultado é lido no banco: o envio falso
// não devolve a resposta da URA, então a escolha vira Atendimento no Setor (ou na recepção).
const SEGREDO = process.env.MENSAGERIA_SEGREDO_ASSINATURA ?? "segredo-falso";
const admin = adminLocal();

const TELEFONE = "61955573091";
const CLIENTE = crypto.randomUUID();
const CNPJ = `8${Date.now()}`.slice(0, 14);
const OPCAO_ATENDENTE = "5";

let sequencia = 0;

function notificacao(texto: string): string {
  sequencia += 1;
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "15550783881", phone_number_id: "1" },
              messages: [
                {
                  from: `55${TELEFONE}`,
                  timestamp: "1749416383",
                  id: `wamid.E2E-URA-${CLIENTE}-${sequencia}`,
                  type: "text",
                  text: { body: texto },
                },
              ],
            },
          },
        ],
      },
    ],
  });
}

async function receber(request: APIRequestContext, texto: string) {
  const corpo = notificacao(texto);
  const assinatura = `sha256=${createHmac("sha256", SEGREDO).update(corpo).digest("hex")}`;
  const resposta = await request.post("/api/webhooks/whatsapp", {
    data: corpo,
    headers: { "content-type": "application/json", "x-hub-signature-256": assinatura },
  });
  expect(resposta.status()).toBe(200);
}

async function atendimentoDoCliente() {
  const { data, error } = await admin
    .from("atendimentos")
    .select("setor, mensagens(autor, texto)")
    .eq("cliente_id", CLIENTE);
  if (error) throw error;
  return data;
}

test.describe("URA: falar com atendente lista os Setores", () => {
  test.beforeAll(async () => {
    const cliente = await admin
      .from("clientes")
      .insert({ id: CLIENTE, empresa: "Ura E2E Ltda", cnpj: CNPJ, regime: "simples_nacional" });
    if (cliente.error) throw cliente.error;
    const contato = await admin.from("cliente_contatos").insert({
      id: crypto.randomUUID(),
      cliente_id: CLIENTE,
      nome: "Dona Ura",
      telefone: "(61) 95557-3091",
      padrao: true,
    });
    if (contato.error) throw contato.error;
  });

  test.beforeEach(async () => {
    await admin.from("atendimentos").delete().eq("cliente_id", CLIENTE);
    await admin.from("atendimento_sessoes").delete().eq("chave", TELEFONE);
  });

  test.afterAll(async () => {
    await admin.from("atendimentos").delete().eq("cliente_id", CLIENTE);
    await admin.from("atendimento_sessoes").delete().eq("chave", TELEFONE);
    await admin.from("clientes").delete().eq("id", CLIENTE);
  });

  test("o número escolhido na lista abre o Atendimento no Setor @smoke", async ({ request }) => {
    await receber(request, OPCAO_ATENDENTE);
    expect(await atendimentoDoCliente()).toEqual([]);

    // Cliente do Simples Nacional: a página 1 é RH, Tributário, Simples Nacional, Contábil, Societário.
    await receber(request, "3");

    const atendimentos = await atendimentoDoCliente();
    expect(atendimentos).toHaveLength(1);
    expect(atendimentos[0].setor).toBe("simples_nacional");
    const textos = atendimentos[0].mensagens;
    expect(textos).toContainEqual({ autor: "contato", texto: "Simples Nacional" });
    expect(
      textos.some((m) => m.autor === "ura" && m.texto.includes("setor Simples Nacional")),
    ).toBe(true);
  });

  test("0 na lista de Setores abre o Atendimento na recepção", async ({ request }) => {
    await receber(request, OPCAO_ATENDENTE);
    await receber(request, "0");

    const atendimentos = await atendimentoDoCliente();
    expect(atendimentos).toHaveLength(1);
    expect(atendimentos[0].setor).toBe("recepcao");
    expect(atendimentos[0].mensagens).toContainEqual({
      autor: "contato",
      texto: "Não sei o setor",
    });
  });
});
