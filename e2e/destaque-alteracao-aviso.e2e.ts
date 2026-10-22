import { expect, test, type Browser, type Page } from "@playwright/test";

import {
  atribuirResponsavelComoLider,
  cnpjUnico,
  empresaUnica,
  login,
  pdf,
} from "./support/criar-cliente";

const SINO = /Avisos de cadastro/;
// Anel de 4 px + deslocamento de 2 px: o anel padrão do foco (2 px + 2 px) termina em 4 px.
const ANEL_DE_4PX = /0px 0px 0px 6px/;
const ABRIR_2 = "Abrir em nova aba: Alteração nº 2 - 01/03/2026";
const ABRIR_3 = "Abrir em nova aba: Alteração nº 3 - 01/04/2026";

const LIDER = { email: "lider.sn@rigonicontabil.local", senha: "lider123" };
const RESPONSAVEL = { email: "funcionario.sn@rigonicontabil.local", senha: "func123" };

// Sem selo = zero não vistos.
async function naoVistos(page: Page): Promise<number> {
  const selo = page.getByTestId("selo-avisos");
  return (await selo.count()) === 0 ? 0 : Number((await selo.textContent()) ?? 0);
}

// A lista reúne os avisos de todos os Clientes: não vistos primeiro, do mais novo para o mais antigo,
// então o primeiro não visto com aquele nº é o do Cliente do teste.
function avisoDaAlteracao(page: Page, numero: number) {
  return page
    .locator('button[data-visto="false"]')
    .filter({
      has: page.getByText(`Nova Alteração contratual nº ${numero}`, { exact: true }),
    })
    .first();
}

// Admin cadastra um Cliente SN com a alteração nº 1 e o Funcionário SN como Responsável.
async function criarClienteComAlteracao1(page: Page, empresa: string): Promise<string> {
  const cnpj = cnpjUnico();
  await login(page, "admin@rigonicontabil.local", "admin123");
  await expect(page).toHaveURL("/");
  await page.goto("/admin/clientes/novo");
  await page.getByLabel("Empresa").fill(empresa);
  await page.getByLabel("CNPJ").fill(cnpj);
  await page.getByLabel("Regime").selectOption("simples_nacional");
  await page.getByRole("button", { name: "Adicionar" }).click();
  await page.getByLabel("Data da alteração 1").fill("2026-02-01");
  await page.getByLabel("Arquivo da alteração 1").setInputFiles(pdf("1-alteracao.pdf"));
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByText(empresa)).toBeVisible();
  return atribuirResponsavelComoLider(cnpj);
}

async function anexar(page: Page, numero: number, data: string) {
  await page.getByRole("button", { name: "Anexar alteração", exact: true }).click();
  const dialogo = page.getByRole("dialog", { name: "Anexar alteração contratual" });
  await dialogo.getByLabel(/^Arquivo/).setInputFiles(pdf(`${numero}-alteracao.pdf`));
  await expect(dialogo.getByLabel("Nº da alteração")).toHaveValue(String(numero));
  await dialogo.getByLabel("Data da alteração").fill(data);
  await dialogo.getByRole("button", { name: "Anexar", exact: true }).click();
  await expect(dialogo).toBeHidden();
}

// Sessão própria (contexto novo) já logada, na tela inicial do perfil.
async function entrar(browser: Browser, usuario: { email: string; senha: string }) {
  const page = await (await browser.newContext()).newPage();
  await login(page, usuario.email, usuario.senha);
  await expect(page).toHaveURL("/simples-nacional");
  return page;
}

test.describe("Destaque do botão Visualizar alteração ao chegar por aviso (#144)", () => {
  test("S1a: Admin anexa nº 2 e nº 3; Líder e Responsável veem o selo e o Admin não; abrir não marca; o clique marca, navega e destaca a alteração do aviso @smoke", async ({
    page,
    browser,
  }) => {
    const clienteId = await criarClienteComAlteracao1(
      page,
      empresaUnica("Destaque Aviso E2E Ltda"),
    );
    const lider = await entrar(browser, LIDER);
    const responsavel = await entrar(browser, RESPONSAVEL);
    await lider.waitForLoadState("networkidle");
    await responsavel.waitForLoadState("networkidle");
    const baseLider = await naoVistos(lider);
    const baseResponsavel = await naoVistos(responsavel);

    await page.goto(`/clientes/${clienteId}`);
    await anexar(page, 2, "2026-03-01");
    await anexar(page, 3, "2026-04-01");
    await expect(page.getByRole("button", { name: ABRIR_3 })).toBeVisible();

    // O Admin não é destinatário: sino sem selo.
    await expect(page.getByRole("button", { name: "Avisos de cadastro" })).toBeVisible();
    await expect(page.getByTestId("selo-avisos")).toHaveCount(0);

    for (const [pessoa, base] of [
      [lider, baseLider],
      [responsavel, baseResponsavel],
    ] as const) {
      await pessoa.reload();
      await expect.poll(() => naoVistos(pessoa)).toBe(base + 2);

      // Abrir o modal não marca nada como visto; o aviso da nº 3 é o mais novo, o da nº 2 vem depois.
      await pessoa.getByRole("button", { name: SINO }).click();
      const aviso3 = avisoDaAlteracao(pessoa, 3);
      const aviso2 = avisoDaAlteracao(pessoa, 2);
      await expect(aviso3).toHaveAttribute("data-visto", "false");
      await expect(aviso2).toHaveAttribute("data-visto", "false");
      expect(await naoVistos(pessoa)).toBe(base + 2);

      // O clique no aviso da nº 2 marca visto, navega e abre a nº 2 (não a mais recente), em destaque.
      await aviso2.click();
      await expect(pessoa).toHaveURL(`/clientes/${clienteId}?alteracao=2`);
      const botao = pessoa.getByRole("button", { name: ABRIR_2 });
      await expect(botao).toBeFocused();
      await expect(botao).toHaveAccessibleDescription(
        "Esta é a alteração do aviso que você abriu.",
      );
      await expect(botao).toHaveCSS("box-shadow", ANEL_DE_4PX);
      // O anel acompanha o foco: ao sair do botão ele some.
      await pessoa.getByRole("heading", { level: 1 }).click();
      await expect(botao).toHaveCSS("box-shadow", "none");
      // A descrição acompanha o destaque, não o foco: continua dizendo de onde se chegou.
      await expect(botao).toHaveAccessibleDescription(
        "Esta é a alteração do aviso que você abriu.",
      );
      await expect(pessoa.getByRole("button", { name: ABRIR_3 })).toHaveCount(0);
      await expect.poll(() => naoVistos(pessoa)).toBe(base + 1);
    }
  });

  test("aviso da alteração mais recente destaca e abre a própria mais recente", async ({
    page,
    browser,
  }) => {
    const clienteId = await criarClienteComAlteracao1(
      page,
      empresaUnica("Destaque Recente E2E Ltda"),
    );
    const lider = await entrar(browser, LIDER);
    await page.goto(`/clientes/${clienteId}`);
    await anexar(page, 2, "2026-03-01");

    await lider.reload();
    await lider.getByRole("button", { name: SINO }).click();
    await avisoDaAlteracao(lider, 2).click();

    await expect(lider).toHaveURL(`/clientes/${clienteId}?alteracao=2`);
    await expect(lider.getByRole("button", { name: ABRIR_2 })).toBeFocused();
  });

  test("sem vir de aviso: a de maior nº, sem destaque; nº inválido ou inexistente na URL também", async ({
    page,
    browser,
  }) => {
    const clienteId = await criarClienteComAlteracao1(
      page,
      empresaUnica("Destaque Sem Aviso E2E Ltda"),
    );
    await page.goto(`/clientes/${clienteId}`);
    await anexar(page, 2, "2026-03-01");
    await anexar(page, 3, "2026-04-01");
    const lider = await entrar(browser, LIDER);

    // URL direta, sem aviso: a mais recente, nada em foco.
    await lider.goto(`/clientes/${clienteId}`);
    const botao = lider.getByRole("button", { name: ABRIR_3 });
    await expect(botao).toBeVisible();
    await expect(botao).not.toBeFocused();
    await expect(botao).toHaveCSS("box-shadow", "none");
    await expect(botao).toHaveAccessibleDescription("");

    // Parâmetro forjado: inválido não destaca; nº que não existe cai na mais recente.
    await lider.goto(`/clientes/${clienteId}?alteracao=abc`);
    await expect(lider.getByRole("button", { name: ABRIR_3 })).not.toBeFocused();
    await lider.goto(`/clientes/${clienteId}?alteracao=99`);
    const semDestaque = lider.getByRole("button", { name: ABRIR_3 });
    await expect(semDestaque).toBeVisible();
    await expect(semDestaque).not.toBeFocused();
    await expect(semDestaque).toHaveCSS("box-shadow", "none");
    await expect(semDestaque).toHaveAccessibleDescription("");
  });

  test("aviso de novo Cliente leva ao formulário sem destaque", async ({ page, browser }) => {
    const empresa = empresaUnica("Destaque Novo Cliente E2E Ltda");
    const clienteId = await criarClienteComAlteracao1(page, empresa);
    const lider = await entrar(browser, LIDER);

    await lider.getByRole("button", { name: SINO }).click();
    await lider
      .getByRole("button", { name: /Novo Cliente no Cadastro operacional/ })
      .first()
      .click();

    await expect(lider).toHaveURL(`/clientes/${clienteId}`);
    await expect(lider.getByLabel("Empresa")).toHaveValue(empresa);
    const botao = lider.getByRole("button", { name: /^Abrir em nova aba: Alteração nº 1/ });
    await expect(botao).toBeVisible();
    await expect(botao).not.toBeFocused();
    await expect(botao).toHaveCSS("box-shadow", "none");
    await expect(botao).toHaveAccessibleDescription("");
  });

  test("hidratação lenta (CPU 20x mais lenta): o botão ainda recebe o foco quando o formulário aparece", async ({
    page,
    browser,
  }) => {
    const clienteId = await criarClienteComAlteracao1(
      page,
      empresaUnica("Destaque CPU Lenta E2E Ltda"),
    );
    await page.goto(`/clientes/${clienteId}`);
    await anexar(page, 2, "2026-03-01");
    await anexar(page, 3, "2026-04-01");
    const lider = await entrar(browser, LIDER);
    const cdp = await lider.context().newCDPSession(lider);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 20 });

    await lider.goto(`/clientes/${clienteId}?alteracao=2`);

    const botao = lider.getByRole("button", { name: ABRIR_2 });
    await expect(botao).toBeVisible({ timeout: 30_000 });
    await expect(botao).toBeFocused({ timeout: 30_000 });
  });

  test("celular (390 px): o rótulo da alteração não se parte e o botão desce para a linha de baixo", async ({
    page,
    browser,
  }) => {
    const clienteId = await criarClienteComAlteracao1(
      page,
      empresaUnica("Destaque Celular E2E Ltda"),
    );
    await page.goto(`/clientes/${clienteId}`);
    await anexar(page, 2, "2026-03-01");
    const contexto = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const celular = await contexto.newPage();
    await login(celular, LIDER.email, LIDER.senha);
    await expect(celular).toHaveURL("/simples-nacional");

    await celular.goto(`/clientes/${clienteId}?alteracao=2`);

    const rotulo = celular.getByText("Alteração nº 2 - 01/03/2026", { exact: true });
    const botao = celular.getByRole("button", { name: ABRIR_2 });
    await expect(botao).toBeFocused();
    const [caixaRotulo, caixaBotao] = await Promise.all([
      rotulo.boundingBox(),
      botao.boundingBox(),
    ]);
    // Uma linha só (a data inteira cabe), e o botão começa abaixo do rótulo, não ao lado.
    expect(caixaRotulo!.height).toBeLessThan(30);
    expect(caixaBotao!.y).toBeGreaterThanOrEqual(caixaRotulo!.y + caixaRotulo!.height);
    // O anel do foco não vaza da tela.
    expect(caixaBotao!.x).toBeGreaterThanOrEqual(0);
    expect(caixaBotao!.x + caixaBotao!.width).toBeLessThanOrEqual(390);
  });

  test("depois de abrir o documento o foco continua no botão (ele não perde o foco ao desabilitar)", async ({
    page,
    browser,
  }) => {
    const clienteId = await criarClienteComAlteracao1(
      page,
      empresaUnica("Destaque Foco Abrir E2E Ltda"),
    );
    await page.goto(`/clientes/${clienteId}`);
    await anexar(page, 2, "2026-03-01");
    const lider = await entrar(browser, LIDER);
    await lider.goto(`/clientes/${clienteId}?alteracao=2`);
    const botao = lider.getByRole("button", { name: ABRIR_2 });
    await expect(botao).toBeFocused();

    // A requisição ao link assinado mostra que a action terminou; o botão volta a abrir de novo.
    await Promise.all([
      lider
        .context()
        .waitForEvent("request", (r) => r.url().includes("/object/sign/documentos-clientes/")),
      botao.press("Enter"),
    ]);

    await expect(botao).toBeEnabled();
    await expect(botao).toBeFocused();
  });
});
