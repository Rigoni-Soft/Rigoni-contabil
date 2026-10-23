import { expect, test } from "@playwright/test";

import { adminLocal } from "./support/admin-local";
import {
  atribuirResponsavelComoLider,
  criarClienteComoAdmin,
  empresaUnica,
  login,
} from "./support/criar-cliente";

// Cliente novo nasce com documento_obrigatorio='negativo' (cadastro automático), então cai no card
// "Sem documento" sem precisar editar nada. Clicar no card abre uma tela própria
// (/clientes/resumo/[bucket]), não um painel inline.

test.describe("Resumo do setor (#36)", () => {
  test("o card 'Sem documento' leva a uma tela própria com o cliente recém-cadastrado, que leva ao cadastro dele", async ({
    page,
  }) => {
    const empresa = empresaUnica("Resumo Setor E2E Ltda");
    await criarClienteComoAdmin(page, empresa);

    await page.goto("/");
    await page.getByRole("link", { name: "Simples Nacional" }).click();

    await expect(page.getByRole("heading", { name: "Resumo do setor" })).toBeVisible();
    await expect(page).toHaveURL(/\/simples-nacional$/);
    await page.getByRole("link", { name: /Sem documento/ }).click();

    await expect(page.getByRole("heading", { name: "Sem documento" })).toBeVisible();
    await expect(page).toHaveURL(/\/clientes\/resumo\/sem_documento$/);

    const linha = page.getByRole("link").filter({ hasText: empresa });
    await expect(linha).toBeVisible();
    await linha.click();

    await expect(page.getByRole("heading", { name: "Editar cadastro operacional" })).toBeVisible();

    // "Voltar" leva pra lista do bucket de onde veio, não pro dashboard.
    await page.getByRole("link", { name: "Voltar" }).click();
    await expect(page.getByRole("heading", { name: "Sem documento" })).toBeVisible();
    await expect(page).toHaveURL(/\/clientes\/resumo\/sem_documento$/);

    await page.getByRole("link", { name: "Voltar ao resumo" }).click();
    await expect(page.getByRole("heading", { name: "Resumo do setor" })).toBeVisible();
  });

  // Salvar uma edição fecha a tela e o dashboard reflete a mudança na hora, sem recarregar.
  test("salvar uma edição move o cliente pro bucket certo e fecha a tela de volta pra lista", async ({
    page,
  }) => {
    const empresa = empresaUnica("Resumo Setor Realtime E2E Ltda");
    const cnpjDigits = await criarClienteComoAdmin(page, empresa);
    await atribuirResponsavelComoLider(cnpjDigits);

    await page.getByRole("button", { name: "Sair" }).click();
    await login(page, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/simples-nacional");

    await page.getByRole("link", { name: /Sem documento/ }).click();
    await page.getByRole("link").filter({ hasText: empresa }).click();

    // Documento recebido vira positivo, DAS continua pendente -> card
    // "DAS pendente" (urgente), não mais "Sem documento".
    await page.getByLabel("Documento recebido").selectOption("positivo");
    await page.getByRole("button", { name: "Salvar" }).click();

    // "Voltar" pro bucket de origem, com a lista já sem o cliente (saiu do
    // bucket "Sem documento" assim que salvou).
    await expect(page).toHaveURL(/\/clientes\/resumo\/sem_documento$/);
    await expect(page.getByText(empresa)).not.toBeVisible();

    await page.getByRole("link", { name: "Voltar ao resumo" }).click();
    await page.getByRole("link", { name: /DAS pendente/ }).click();

    await expect(page.getByText(empresa)).toBeVisible();
  });

  // Grupo Parcelamento: 6 cards que contam Clientes e não se excluem; as listas mostram a marca
  // "interno" e o status do mês por parcelamento.
  test("os cards de parcelamento contam o Cliente em mais de um card e a lista mostra interno e status do mês", async ({
    page,
  }) => {
    const empresa = empresaUnica("Resumo Parcelamento E2E Ltda");
    const cnpj = await criarClienteComoAdmin(page, empresa);
    const admin = adminLocal();
    const { data } = await admin.from("clientes").select("id").eq("cnpj", cnpj).single();
    const clienteId = data!.id as string;
    const comum = crypto.randomUUID();
    const interno = crypto.randomUUID();
    const novo = (id: string, codigo: string, ehInterno: boolean) => ({
      id,
      cliente_id: clienteId,
      codigo,
      parcelas_restantes: 5,
      interno: ehInterno,
      situacao: "em_aberto",
      arquivo_caminho: `${clienteId}/${id}-acordo.pdf`,
    });
    await admin
      .from("cliente_parcelamentos")
      .insert([novo(comum, "PARC-COMUM", false), novo(interno, "PARC-INTERNO", true)]);
    // Só o comum tem a guia do mês enviada (o sistema grava; aqui, a chave de serviço).
    const parcela = new Date()
      .toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })
      .slice(0, 7)
      .replace("-", "");
    await admin.from("cliente_parcelamento_envios").insert({ parcelamento_id: comum, parcela });

    await page.goto("/simples-nacional");
    for (const titulo of [
      "Com parcelamento",
      "Em aberto",
      "Parcelamento pendente",
      "Pendente em atraso",
      "Parcelamento interno",
      "Parcelamento enviado",
    ]) {
      await expect(page.getByRole("link", { name: new RegExp(titulo) }).first()).toBeVisible();
    }

    // Pendente (o interno ainda sem envio) e interno listam o mesmo Cliente, com os dois parcelamentos.
    for (const [card, bucket] of [
      ["Parcelamento pendente", "parcelamento_pendente"],
      ["Parcelamento interno", "parcelamento_interno"],
    ] as const) {
      await page.goto("/simples-nacional");
      await page.getByRole("link", { name: new RegExp(card) }).click();
      await expect(page).toHaveURL(new RegExp(`/clientes/resumo/${bucket}$`));
      // Os parcelamentos ficam abaixo do link (fora dele): o item da lista os reúne com o Cliente.
      const linha = page.getByRole("listitem").filter({ hasText: empresa }).first();
      await expect(linha).toContainText("PARC-COMUM");
      await expect(linha).toContainText("Enviado no mês");
      await expect(linha).toContainText("PARC-INTERNO");
      await expect(linha).toContainText("Interno");
      await expect(linha).toContainText("Pendente no mês");
    }

    // Não está "enviado" (falta o interno) nem "em atraso" antes do dia 29, mas o card sempre abre.
    await page.goto("/clientes/resumo/parcelamento_enviado");
    await expect(page.getByText(empresa)).not.toBeVisible();
  });
});
