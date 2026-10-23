import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { adminLocal } from "./support/admin-local";
import {
  atribuirResponsavelComoLider,
  criarClienteComoAdmin,
  login,
} from "./support/criar-cliente";

// O leitor falso (padrão em e2e) lê os marcadores do texto do PDF: sem marcador sugere
// FALSO-123456 e 12 parcelas; `[leitor:falha]` não lê; `[leitor:sem-codigo]` lê só as 7 parcelas.
const pdf = (nome: string, marcador = "") => ({
  name: nome,
  mimeType: "application/pdf",
  buffer: Buffer.from(`%PDF-1.4 teste ${marcador}`),
});

// Anexar dispara a leitura, que preenche a linha: quem digita depois não é sobrescrito.
async function anexarEEsperarSugestao(page: Page, indice: number, arquivo: ReturnType<typeof pdf>) {
  await page.locator(`[id='parcelamentos.${indice}.arquivo']`).setInputFiles(arquivo);
  await expect(page.locator(`[id='parcelamentos.${indice}.codigo']`)).toHaveValue("FALSO-123456");
}

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
    await expect(
      page.getByRole("status").filter({ hasText: "Tem parcelamento: Não" }),
    ).toBeVisible();

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

    await anexarEEsperarSugestao(page, 0, pdf("acordo-100.pdf"));
    await page.locator("[id='parcelamentos.0.codigo']").fill("PARC-100");
    await page.locator("[id='parcelamentos.0.parcelasRestantes']").fill("24");
    await page.getByRole("button", { name: "Adicionar parcelamento" }).click();
    await anexarEEsperarSugestao(page, 1, pdf("acordo-200.pdf"));
    // Código é opcional: em branco, o sistema gera um ao salvar.
    await page.locator("[id='parcelamentos.1.codigo']").fill("");
    await page.locator("[id='parcelamentos.1.parcelasRestantes']").fill("6");
    await page.getByRole("checkbox", { name: "É interno" }).nth(1).check();
    // O resumo só conta o que já foi salvo, não as linhas em digitação.
    await expect(
      page.getByRole("status").filter({ hasText: "Tem parcelamento: Não" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page).toHaveURL("/simples-nacional");

    // Persistiu: resumo, códigos, interno, selo do mês e nome do PDF.
    await page.goto(`/clientes/${clienteId}`);
    await expect(page.getByRole("status").filter({ hasText: "Sim (2)" })).toBeVisible();
    await expect(page.locator("[id='parcelamentos.0.codigo']")).toHaveValue("PARC-100");
    await expect(page.locator("[id='parcelamentos.0.parcelasRestantes']")).toHaveValue("24");
    await expect(page.locator("[id='parcelamentos.1.codigo']")).toHaveValue(/^PARC-[0-9A-F]{8}$/);
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

  test("PDF lido vira sugestão: corrige e salva; PDF sem código ganha um interno (#125) @smoke", async ({
    page,
  }) => {
    const clienteId = await abrirComoFuncionarioSn(page, "Leitura PDF E2E Ltda");
    await page.getByRole("button", { name: "Adicionar parcelamento" }).click();
    await anexarEEsperarSugestao(page, 0, pdf("acordo-lido.pdf"));
    await expect(page.getByText("Sugerido pelo PDF: confira")).toBeVisible();
    await expect(
      page.getByText(/PGFN · 12 parcelas · R\$\s316,20 · adesão 27\/08\/2026/),
    ).toBeVisible();
    await expect(page.locator("[id='parcelamentos.0.parcelasRestantes']")).toHaveValue("12");

    // Recibo de Adesão: só a quantidade vem do PDF; o código é gerado e pode ser trocado.
    await page.getByRole("button", { name: "Adicionar parcelamento" }).click();
    await page
      .locator("[id='parcelamentos.1.arquivo']")
      .setInputFiles(pdf("recibo.pdf", "[leitor:sem-codigo]"));
    await expect(page.getByText(/O PDF não traz código/)).toBeVisible();
    await expect(page.locator("[id='parcelamentos.1.parcelasRestantes']")).toHaveValue("7");
    await expect(page.locator("[id='parcelamentos.1.codigo']")).toHaveValue(/^PARC-[0-9A-F]{8}$/);

    // Corrige a sugestão da primeira linha e salva.
    await page.locator("[id='parcelamentos.0.parcelasRestantes']").fill("10");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page).toHaveURL("/simples-nacional");

    await page.goto(`/clientes/${clienteId}`);
    await expect(page.locator("[id='parcelamentos.0.codigo']")).toHaveValue("FALSO-123456");
    await expect(page.locator("[id='parcelamentos.0.parcelasRestantes']")).toHaveValue("10");
    await expect(page.locator("[id='parcelamentos.1.parcelasRestantes']")).toHaveValue("7");
    // Os dados do acordo ficam gravados e voltam na tela.
    await expect(page.getByText(/PGFN · 12 parcelas/)).toBeVisible();
    await expect(page.getByText(/Receita Federal · 7 parcelas/)).toBeVisible();
  });

  test("PDF de outra empresa avisa para conferir, sem bloquear o salvar (#125)", async ({
    page,
  }) => {
    await abrirComoFuncionarioSn(page, "Leitura CNPJ E2E Ltda");
    await page.getByRole("button", { name: "Adicionar parcelamento" }).click();
    await page
      .locator("[id='parcelamentos.0.arquivo']")
      .setInputFiles(pdf("outra-empresa.pdf", "[leitor:cnpj-outro]"));

    await expect(
      page.getByRole("alert").filter({ hasText: /CNPJ do PDF é diferente/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar" })).toBeEnabled();
  });

  test("leitura que falha libera os campos para digitar à mão (#125)", async ({ page }) => {
    const clienteId = await abrirComoFuncionarioSn(page, "Leitura Falha E2E Ltda");
    await page.getByRole("button", { name: "Adicionar parcelamento" }).click();
    await page
      .locator("[id='parcelamentos.0.arquivo']")
      .setInputFiles(pdf("ilegivel.pdf", "[leitor:falha]"));

    await expect(page.getByText("não consegui ler: digite à mão")).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar" })).toBeEnabled();
    await page.locator("[id='parcelamentos.0.codigo']").fill("MANUAL-1");
    await page.locator("[id='parcelamentos.0.parcelasRestantes']").fill("3");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page).toHaveURL("/simples-nacional");

    await page.goto(`/clientes/${clienteId}`);
    await expect(page.locator("[id='parcelamentos.0.codigo']")).toHaveValue("MANUAL-1");
  });

  test("parcelamento com guia enviada mostra o selo Enviado e não pode ser removido", async ({
    page,
  }) => {
    const clienteId = await abrirComoFuncionarioSn(page, "Parcelamento Enviado E2E Ltda");
    await page.getByRole("button", { name: "Adicionar parcelamento" }).click();
    await anexarEEsperarSugestao(page, 0, pdf("acordo-300.pdf"));
    await page.locator("[id='parcelamentos.0.codigo']").fill("PARC-300");
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
  test("editar outro parcelamento não é barrado pelo quitado da lista, que volta intacto", async ({
    page,
  }) => {
    const clienteId = await abrirComoFuncionarioSn(page, "Parcelamento Quitado E2E Ltda");
    // Quitar é do sistema (job, sem sessão): aqui, a chave de serviço.
    const admin = adminLocal();
    const mk = async (codigo: string, parcelas: number, situacao: string) => {
      const id = crypto.randomUUID();
      await admin.from("cliente_parcelamentos").insert({
        id,
        cliente_id: clienteId,
        codigo,
        parcelas_restantes: parcelas,
        situacao,
        arquivo_caminho: `${clienteId}/${id}-${codigo}.pdf`,
      });
    };
    await mk("QUITADO-1", 0, "quitado");
    await mk("ABERTO-2", 5, "em_aberto");

    await page.goto(`/clientes/${clienteId}`);
    await expect(page.getByText("Quitado", { exact: true })).toBeVisible();
    await page.locator("[id='parcelamentos.1.parcelasRestantes']").fill("4");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page).toHaveURL("/simples-nacional");

    await page.goto(`/clientes/${clienteId}`);
    await expect(page.locator("[id='parcelamentos.1.parcelasRestantes']")).toHaveValue("4");
    await expect(page.locator("[id='parcelamentos.0.parcelasRestantes']")).toHaveValue("0");
  });
});
