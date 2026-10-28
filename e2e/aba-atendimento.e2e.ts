import { expect, test } from "./fixtures";
import { adminLocal } from "./support/admin-local";
import { login } from "./support/criar-cliente";

// Os Atendimentos nascem direto no banco, já na espera do Setor (sem Funcionário).
const admin = adminLocal();

const TELEFONE = "61955574001";
const CLIENTE = crypto.randomUUID();
const CNPJ = `5${Date.now()}`.slice(0, 14);

test.describe("Aba Atendimento: Em espera / Em atendimento (#162)", () => {
  test.beforeAll(async () => {
    await admin.from("atendimentos").delete().eq("chave_telefone", TELEFONE);
    // A espera é do Setor inteiro: Atendimentos soltos de outras execuções mudariam as contagens.
    await admin.from("atendimentos").delete().eq("setor", "financeiro").is("funcionario_id", null);
    const cliente = await admin
      .from("clientes")
      .insert({ id: CLIENTE, empresa: "Aba E2E Ltda", cnpj: CNPJ, regime: "lucro_presumido" });
    if (cliente.error) throw cliente.error;
    const contato = await admin.from("cliente_contatos").insert({
      id: crypto.randomUUID(),
      cliente_id: CLIENTE,
      nome: "Dona Aba",
      telefone: "(61) 95557-4001",
      padrao: true,
    });
    if (contato.error) throw contato.error;
    const atendimento = await admin
      .from("atendimentos")
      .insert({
        telefone: `55${TELEFONE}`,
        chave_telefone: TELEFONE,
        cliente_id: CLIENTE,
        setor: "financeiro",
        fila_desde: new Date(Date.now() - 5 * 60_000).toISOString(),
      })
      .select("id")
      .single();
    if (atendimento.error) throw atendimento.error;
    const mensagem = await admin.from("mensagens").insert({
      atendimento_id: atendimento.data.id,
      autor: "contato",
      texto: "Preciso da segunda via do boleto",
      id_externo: "wamid.E2E-ABA",
    });
    if (mensagem.error) throw mensagem.error;
  });

  test.afterAll(async () => {
    await admin.from("atendimentos").delete().eq("chave_telefone", TELEFONE);
    await admin.from("clientes").delete().eq("id", CLIENTE);
  });

  test("dois usuários do Setor: um assume e o outro vê 'já assumido'; o dono encerra @smoke", async ({
    browser,
  }) => {
    const ana = await (await browser.newContext()).newPage();
    const beto = await (await browser.newContext()).newPage();

    await login(ana, "funcionario.financeiro@rigonicontabil.local", "func123");
    await expect(ana).toHaveURL("/");
    await login(beto, "funcionario2.financeiro@rigonicontabil.local", "func123");
    await expect(beto).toHaveURL("/");

    // A aba "Atendimento" do menu leva à tela, com as duas abas sobrepostas.
    for (const pagina of [ana, beto]) {
      await pagina
        .getByRole("navigation", { name: "Setores" })
        .getByRole("link", { name: "Atendimento" })
        .click();
      await expect(pagina).toHaveURL("/atendimento");
      await expect(pagina.getByRole("tab", { name: /Em espera/ })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(pagina.getByRole("tab", { name: /Em atendimento/ })).toBeVisible();
      await expect(
        pagina.getByRole("button", { name: /Assumir o atendimento de Dona Aba/ }),
      ).toBeVisible();
    }

    // Ana assume: o Atendimento vira dela e o chat abre no centro, sem trocar de rota.
    await ana.getByRole("button", { name: /Assumir o atendimento de Dona Aba/ }).click();
    await expect(ana.getByRole("tab", { name: /Em atendimento/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      ana.getByRole("list", { name: "Mensagens" }).getByText("Preciso da segunda via do boleto"),
    ).toBeVisible();
    await expect(ana).toHaveURL("/atendimento");

    // Beto ainda via o card: quem perde a corrida recebe o aviso e o card some.
    await beto.getByRole("button", { name: /Assumir o atendimento de Dona Aba/ }).click();
    await expect(beto.getByText("Atendimento já assumido por outra pessoa.")).toBeVisible();
    await expect(
      beto.getByRole("button", { name: /Assumir o atendimento de Dona Aba/ }),
    ).toHaveCount(0);

    // Ana encerra pelo painel; a conversa fecha e a lista fica vazia.
    await ana.getByRole("button", { name: "Encerrar atendimento" }).click();
    await ana.getByRole("button", { name: "Confirmar encerramento" }).click();
    await expect(ana.getByText("Escolha um atendimento para conversar.")).toBeVisible();
    await expect(ana.getByText("Você não tem atendimentos em andamento.")).toBeVisible();
    await expect(ana).toHaveURL("/atendimento");

    const encerrado = await admin
      .from("atendimentos")
      .select("status")
      .eq("chave_telefone", TELEFONE)
      .single();
    expect(encerrado.data?.status).toBe("encerrado");
  });

  test("o Admin escolhe o Setor da espera", async ({ page }) => {
    await admin
      .from("atendimentos")
      .update({
        status: "em_andamento",
        funcionario_id: null,
        fila_desde: new Date().toISOString(),
      })
      .eq("chave_telefone", TELEFONE);
    await login(page, "admin@rigonicontabil.local", "admin123");
    await expect(page).toHaveURL("/");

    await page.goto("/atendimento");
    await page.getByRole("combobox", { name: "Setor" }).selectOption("financeiro");

    await expect(
      page.getByRole("button", { name: /Assumir o atendimento de Dona Aba/ }),
    ).toBeVisible();
  });
});
