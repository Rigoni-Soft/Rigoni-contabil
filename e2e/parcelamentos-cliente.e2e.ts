import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { adminLocal } from "./support/admin-local";
import {
  atribuirResponsavelComoLider,
  criarClienteComoAdmin,
  login,
} from "./support/criar-cliente";

const pdf = (nome: string) => ({
  name: nome,
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4 teste"),
});

async function abrirComoFuncionarioSn(page: Page, empresa: string) {
  const cnpj = await criarClienteComoAdmin(page, empresa);
  await atribuirResponsavelComoLider(cnpj);
  const { data } = await adminLocal().from("clientes").select("id").eq("cnpj", cnpj).single();
  const clienteId = data!.id as string;

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, "funcionario.sn@rigonicontabil.local", "func123");
  await expect(page).toHaveURL("/simples-nacional");
  await page.goto(`/clientes/${clienteId}`);
  await expect(page.getByRole("heading", { name: "Editar cadastro operacional" })).toBeVisible();
  // Espera a hidratação: preencher antes dela deixa o React Hook Form reaplicar os valores iniciais.
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
  return clienteId;
}

test.describe("Parcelamentos no Editar cliente (#122)", () => {
  test("Funcionário SN cadastra parcelamentos com PDF, edita e remove @smoke", async ({ page }) => {
    const clienteId = await abrirComoFuncionarioSn(page, "Parcelamentos E2E Ltda");
    await expect(page.getByText("Tem parcelamento")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: /^Não$/ })).toBeVisible();

    // PDF é obrigatório; parcelas restantes têm mínimo 1.
    await page.getByRole("button", { name: "Adicionar parcelamento" }).click();
    await page.locator("[id='parcelamentos.0.codigo']").fill("PARC-100");
    await expect(page.locator("[id='parcelamentos.0.parcelasRestantes']")).toHaveAttribute(
      "min",
      "1",
    );
    await page.locator("[id='parcelamentos.0.parcelasRestantes']").fill("24");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Anexe o PDF do parcelamento")).toBeVisible();

    await page.locator("[id='parcelamentos.0.arquivo']").setInputFiles(pdf("acordo-100.pdf"));
    await page.getByRole("button", { name: "Adicionar parcelamento" }).click();
    await page.locator("[id='parcelamentos.1.codigo']").fill("PARC-200");
    await page.locator("[id='parcelamentos.1.parcelasRestantes']").fill("6");
    await page.getByRole("checkbox", { name: "É interno" }).nth(1).check();
    await page.locator("[id='parcelamentos.1.arquivo']").setInputFiles(pdf("acordo-200.pdf"));
    await expect(page.getByRole("status").filter({ hasText: "Sim (2)" })).toBeVisible();

    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page).toHaveURL("/simples-nacional");

    // Persistiu: resumo, códigos, interno, selo do mês e nome do PDF.
    await page.goto(`/clientes/${clienteId}`);
    await expect(page.getByRole("status").filter({ hasText: "Sim (2)" })).toBeVisible();
    await expect(page.locator("[id='parcelamentos.0.codigo']")).toHaveValue("PARC-100");
    await expect(page.locator("[id='parcelamentos.0.parcelasRestantes']")).toHaveValue("24");
    await expect(page.locator("[id='parcelamentos.1.codigo']")).toHaveValue("PARC-200");
    await expect(page.getByRole("checkbox", { name: "É interno" }).nth(1)).toBeChecked();
    await expect(page.getByText("Pendente no mês")).toHaveCount(2);
    await expect(page.getByText(/PDF anexado: acordo-100\.pdf/)).toBeVisible();

    // Edita as parcelas e remove o segundo (o PDF dele sai do Storage junto).
    await page.locator("[id='parcelamentos.0.parcelasRestantes']").fill("20");
    await page.getByRole("button", { name: "Remover parcelamento 2" }).click();
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page).toHaveURL("/simples-nacional");

    await page.goto(`/clientes/${clienteId}`);
    await expect(page.getByRole("status").filter({ hasText: "Sim (1)" })).toBeVisible();
    await expect(page.locator("[id='parcelamentos.0.parcelasRestantes']")).toHaveValue("20");
    const { data: objetos } = await adminLocal()
      .storage.from("parcelamentos-clientes")
      .list(clienteId);
    expect(objetos?.map((o) => o.name).join(",")).toContain("acordo-100.pdf");
    expect(objetos?.map((o) => o.name).join(",")).not.toContain("acordo-200.pdf");
  });

  test("parcelamento com guia enviada mostra o selo Enviado e não pode ser removido", async ({
    page,
  }) => {
    const clienteId = await abrirComoFuncionarioSn(page, "Parcelamento Enviado E2E Ltda");
    await page.getByRole("button", { name: "Adicionar parcelamento" }).click();
    await page.locator("[id='parcelamentos.0.codigo']").fill("PARC-300");
    await page.locator("[id='parcelamentos.0.arquivo']").setInputFiles(pdf("acordo-300.pdf"));
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page).toHaveURL("/simples-nacional");

    // Quem registra o envio é o sistema (job, sem sessão): aqui, a chave de serviço.
    const admin = adminLocal();
    const { data } = await admin
      .from("cliente_parcelamentos")
      .select("id")
      .eq("cliente_id", clienteId)
      .single();
    const agora = new Date();
    const parcela = `${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, "0")}`;
    await admin.from("cliente_parcelamento_envios").insert({ parcelamento_id: data!.id, parcela });

    await page.goto(`/clientes/${clienteId}`);
    await expect(page.getByText("Enviado no mês")).toBeVisible();
    await expect(page.getByRole("button", { name: "Remover parcelamento 1" })).toBeDisabled();
    await expect(page.getByText("Já teve guia enviada: não pode ser removido.")).toBeVisible();
  });
});
