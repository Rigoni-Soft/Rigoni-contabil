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
    await page.locator("[id='parcelamentos.0.codigo']").fill("PARC-100");
    await expect(page.locator("[id='parcelamentos.0.parcelasRestantes']")).toHaveAttribute(
      "min",
      "1",
    );
    await page.locator("[id='parcelamentos.0.parcelasRestantes']").fill("24");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
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

    await page.getByRole("button", { name: "Salvar", exact: true }).click();
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

    // O leitor falso lê todo acordo como PGFN: cadastrado, ele não se edita (só ganha guias, #184).
    await expect(page.locator("[id='parcelamentos.0.parcelasRestantes']")).toBeDisabled();
    // Remove o segundo (o PDF dele sai do Storage junto).
    await page.getByRole("button", { name: "Remover parcelamento 2" }).click();
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page).toHaveURL("/simples-nacional");

    await page.goto(`/clientes/${clienteId}`);
    await expect(page.getByRole("status").filter({ hasText: "Sim (1)" })).toBeVisible();
    await expect(page.locator("[id='parcelamentos.0.parcelasRestantes']")).toHaveValue("24");
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
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
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
    await page
      .locator("[id='parcelamentos.0.arquivo']")
      .setInputFiles(pdf("outra-empresa.pdf", "[leitor:cnpj-outro]"));

    await expect(
      page.getByRole("alert").filter({ hasText: /CNPJ do PDF é diferente/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar", exact: true })).toBeEnabled();
  });

  test("leitura que falha libera os campos para digitar à mão (#125)", async ({ page }) => {
    const clienteId = await abrirComoFuncionarioSn(page, "Leitura Falha E2E Ltda");
    await page
      .locator("[id='parcelamentos.0.arquivo']")
      .setInputFiles(pdf("ilegivel.pdf", "[leitor:falha]"));

    await expect(page.getByText("não consegui ler: digite à mão")).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar", exact: true })).toBeEnabled();
    await page.locator("[id='parcelamentos.0.codigo']").fill("MANUAL-1");
    await page.locator("[id='parcelamentos.0.parcelasRestantes']").fill("3");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page).toHaveURL("/simples-nacional");

    await page.goto(`/clientes/${clienteId}`);
    await expect(page.locator("[id='parcelamentos.0.codigo']")).toHaveValue("MANUAL-1");
  });

  test("parcelamento com guia enviada mostra o selo Enviado e não pode ser removido", async ({
    page,
  }) => {
    const clienteId = await abrirComoFuncionarioSn(page, "Parcelamento Enviado E2E Ltda");
    await anexarEEsperarSugestao(page, 0, pdf("acordo-300.pdf"));
    await page.locator("[id='parcelamentos.0.codigo']").fill("PARC-300");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
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
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page).toHaveURL("/simples-nacional");

    await page.goto(`/clientes/${clienteId}`);
    await expect(page.locator("[id='parcelamentos.1.parcelasRestantes']")).toHaveValue("4");
    await expect(page.locator("[id='parcelamentos.0.parcelasRestantes']")).toHaveValue("0");
  });
});

test.describe("Parcelamento da Receita cadastrado segue editável (#184)", () => {
  test("edita parcelas e código; só o PGFN ficou imutável @smoke", async ({ page }) => {
    const clienteId = await abrirComoFuncionarioSn(page, "Parcelamento Receita E2E Ltda");
    const id = crypto.randomUUID();
    const { error } = await adminLocal()
      .from("cliente_parcelamentos")
      .insert({
        id,
        cliente_id: clienteId,
        codigo: "RFB-100",
        parcelas_restantes: 10,
        interno: false,
        arquivo_caminho: `${clienteId}/${id}-receita.pdf`,
        origem: "receita_federal",
        total_parcelas: 12,
        valor_parcela_centavos: 10000,
        data_adesao: "2026-01-27",
      });
    expect(error).toBeNull();
    await page.goto(`/clientes/${clienteId}`);
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);

    await expect(page.locator("[id='parcelamentos.0.codigo']")).toBeEnabled();
    await page.locator("[id='parcelamentos.0.codigo']").fill("RFB-200");
    await page.locator("[id='parcelamentos.0.parcelasRestantes']").fill("8");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page).toHaveURL("/simples-nacional");

    await page.goto(`/clientes/${clienteId}`);
    await expect(page.locator("[id='parcelamentos.0.codigo']")).toHaveValue("RFB-200");
    await expect(page.locator("[id='parcelamentos.0.parcelasRestantes']")).toHaveValue("8");
  });
});

test.describe("Guia anexada da parcela PGFN: trocar, visualizar e remover (#184)", () => {
  test("troca, abre por link temporário, remove e o acordo cadastrado só ganha guias @smoke", async ({
    page,
  }) => {
    const clienteId = await abrirComoFuncionarioSn(page, "Guia Parcela E2E Ltda");
    const { data: cliente } = await adminLocal()
      .from("clientes")
      .select("cnpj")
      .eq("id", clienteId)
      .single();
    // O leitor falso lê o acordo como PGFN (código FALSO-123456); a guia confirma quando o PDF traz
    // o CNPJ do Cliente, a conta do acordo e a competência.
    const guia = (competencia: string) =>
      pdf(`guia-${competencia}.pdf`, `[leitor:guia=${cliente!.cnpj};FALSO-123456;${competencia}]`);
    await anexarEEsperarSugestao(page, 0, pdf("acordo-guia.pdf"));
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page).toHaveURL("/simples-nacional");
    await page.goto(`/clientes/${clienteId}`);
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);

    // Acordo PGFN cadastrado só ganha guias: código, restantes e "É interno" não se editam.
    await expect(page.locator("[id='parcelamentos.0.codigo']")).toBeDisabled();
    await expect(page.locator("[id='parcelamentos.0.parcelasRestantes']")).toBeDisabled();
    await expect(page.getByRole("checkbox", { name: "É interno" })).toBeDisabled();

    const regiao = page.getByRole("group", { name: "Guias da parcela" });
    // O aviso sai antes de a lista recarregar: agir nesse meio-tempo cai no "Aguarde", não na ação.
    const livre = () => expect(regiao).not.toHaveAttribute("aria-busy", "true");
    await regiao.getByLabel(/pdf da guia/i).setInputFiles(guia("202610"));
    await regiao.getByRole("button", { name: "Anexar guia" }).click();
    await expect(regiao.getByText("Guia anexada e confirmada: liberada ao envio.")).toBeVisible();
    await expect(regiao.getByText(/10\/2026 · conta FALSO-123456/)).toBeVisible();

    // Troca por um PDF que não confere: a guia volta a "a confirmar" e o motivo aparece.
    await livre();
    await regiao.getByLabel("Trocar guia de 10/2026").setInputFiles(pdf("guia-sem-dados.pdf"));
    await expect(regiao.getByText(/guia trocada, mas ainda não liberada/i)).toBeVisible();
    await expect(regiao.getByText("A confirmar")).toBeVisible();
    // Troca por um PDF de outro mês é recusada e a guia fica como estava.
    await livre();
    await regiao.getByLabel("Trocar guia de 10/2026").setInputFiles(guia("202611"));
    await expect(regiao.getByText(/PDF é de outra competência/i)).toBeVisible();
    await expect(regiao.getByText("A confirmar")).toBeVisible();
    await livre();
    await regiao.getByLabel("Trocar guia de 10/2026").setInputFiles(guia("202610"));
    await expect(regiao.getByText(/guia trocada e confirmada/i)).toBeVisible();
    // Só o PDF atual sobra no Storage (o antigo é apagado a cada troca).
    const { data: parcelamento } = await adminLocal()
      .from("cliente_parcelamentos")
      .select("id")
      .eq("cliente_id", clienteId)
      .single();
    const prefixo = `${clienteId}/guias-pgfn/${parcelamento!.id}`;
    const objetos = () => adminLocal().storage.from("parcelamentos-clientes").list(prefixo);
    expect((await objetos()).data).toHaveLength(1);

    // Visualizar: o link temporário abre numa aba nova.
    await livre();
    const [requisicao] = await Promise.all([
      page
        .context()
        .waitForEvent("request", (r) => r.url().includes("/object/sign/parcelamentos-clientes/")),
      regiao.getByRole("button", { name: "Ver guia de 10/2026", exact: true }).click(),
    ]);
    expect(requisicao.url()).toContain("token=");

    // Remover apaga o registro e o objeto.
    await livre();
    await regiao.getByRole("button", { name: "Remover guia de 10/2026" }).click();
    await regiao.getByRole("button", { name: "Confirmar remoção da guia de 10/2026" }).click();
    await expect(regiao.getByText("Guia removida.")).toBeVisible();
    await expect(regiao.getByText("Nenhuma guia anexada.")).toBeVisible();
    expect((await objetos()).data).toHaveLength(0);
  });
});
