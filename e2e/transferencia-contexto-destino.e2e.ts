import { expect, test } from "./fixtures";
import { abrirConversaEmAtendimento } from "./support/abrir-conversa";
import { adminLocal } from "./support/admin-local";
import { login } from "./support/criar-cliente";

// O Funcionário transfere pelo painel e o destino lê, na conversa, o contato, a empresa, o CNPJ,
// quem transferiu e o resumo. O Líder do Contábil lê o Atendimento mesmo na espera do Setor.
const admin = adminLocal();

const FUNCIONARIO = "55555555-5555-5555-5555-555555555555";
const TELEFONE = "61955574001";
const CLIENTE = crypto.randomUUID();
const CNPJ = `7${Date.now()}`.slice(0, 14);
const RESUMO = "Cliente quer revisar o DAS de setembro";

test.describe("Contexto da Transferência (#74)", () => {
  test.beforeAll(async () => {
    await admin.from("atendimentos").delete().eq("funcionario_id", FUNCIONARIO);
    const cliente = await admin
      .from("clientes")
      .insert({ id: CLIENTE, empresa: "Contexto E2E Ltda", cnpj: CNPJ, regime: "lucro_presumido" });
    if (cliente.error) throw cliente.error;
    const contato = await admin.from("cliente_contatos").insert({
      id: crypto.randomUUID(),
      cliente_id: CLIENTE,
      nome: "Seu Contexto",
      telefone: "(61) 95557-4001",
      padrao: true,
    });
    if (contato.error) throw contato.error;
    const atendimento = await admin.from("atendimentos").insert({
      telefone: `55${TELEFONE}`,
      chave_telefone: TELEFONE,
      cliente_id: CLIENTE,
      setor: "financeiro",
      funcionario_id: FUNCIONARIO,
      assumido_em: new Date().toISOString(),
    });
    if (atendimento.error) throw atendimento.error;
  });

  test.afterAll(async () => {
    await admin.from("atendimentos").delete().eq("cliente_id", CLIENTE);
    await admin.from("clientes").delete().eq("id", CLIENTE);
  });

  test("o destino lê o contato, a empresa, o CNPJ, quem transferiu e o resumo @smoke", async ({
    page,
  }) => {
    await login(page, "funcionario2.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await abrirConversaEmAtendimento(page, /Seu Contexto/);

    const painel = page.getByRole("complementary", { name: "Ações do Atendimento" });
    await painel.getByLabel("Setor de destino").selectOption({ label: "Contábil" });
    await painel.getByLabel("Resumo do assunto").fill(RESUMO);
    await painel.getByRole("button", { name: "Transferir" }).click();
    await expect(page.getByText("Você não tem atendimentos em andamento.")).toBeVisible();

    const atendimento = await admin
      .from("atendimentos")
      .select("id")
      .eq("cliente_id", CLIENTE)
      .single();
    if (atendimento.error) throw atendimento.error;

    // Só a sessão do Supabase: limpar tudo apagaria também o cookie de bypass da proteção do preview.
    await page.context().clearCookies({ name: /^sb-/ });
    await login(page, "lider.contabil@rigonicontabil.local", "lider123");
    await expect(page).toHaveURL("/");
    await page.goto("/atendimento");
    // Está na espera do Setor, dirigida ou não ao Líder: o card abre a conversa (assume ou só lê).
    await page.getByRole("button", { name: /(Assumir|Ler) o atendimento de Seu Contexto/ }).click();

    const contexto = page.getByRole("region", { name: "Contexto do Atendimento" });
    await expect(page.getByRole("heading", { name: "Seu Contexto" })).toBeVisible();
    // O cabeçalho da conversa traz o telefone; o cartão da espera, não.
    await expect(page.getByText(/Contexto E2E Ltda · \S+ · \(61\)/)).toBeVisible();
    await expect(
      contexto.getByText("Transferido por Segundo Funcionário Financeiro · Financeiro"),
    ).toBeVisible();
    await expect(contexto.getByText(RESUMO)).toBeVisible();
  });

  test("o Atendimento aberto pela URA mostra o resumo e, sem Cliente, o CNPJ informado @smoke", async ({
    page,
  }) => {
    const telefone = "61955574002";
    const aberto = await admin
      .from("atendimentos")
      .insert({
        telefone: `55${telefone}`,
        chave_telefone: telefone,
        setor: "recepcao",
        fila_desde: new Date().toISOString(),
        resumo_ura: "Quer abrir uma empresa nova",
        cnpj_informado: "11444777000161",
      })
      .select("id")
      .single();
    if (aberto.error) throw aberto.error;

    try {
      await login(page, "funcionario.recepcao@rigonicontabil.local", "func123");
      await expect(page).toHaveURL("/");
      await page.goto("/atendimento");
      await page
        .getByRole("button", { name: /(Assumir|Ler) o atendimento de/ })
        .filter({ hasText: "Quer abrir uma empresa nova" })
        .click();

      await expect(page.getByText("Aberto pela URA")).toBeVisible();
      await expect(page.getByText("Quer abrir uma empresa nova")).toBeVisible();
      await expect(
        page.getByText("Provável cliente novo · CNPJ informado 11.444.777/0001-61"),
      ).toBeVisible();
    } finally {
      await admin.from("atendimentos").delete().eq("id", aberto.data.id);
    }
  });
});
