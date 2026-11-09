import { expect, test } from "./fixtures";
import { adminLocal } from "./support/admin-local";
import { cnpjUnico, login } from "./support/criar-cliente";

// Acompanhamento dos funcionários no dashboard do RH: o Líder vê um card por Funcionário (pontos x atribuídos),
// abre o detalhe com o cliente pendente no serviço que falta e acha os clientes sem Responsável no card
// "Sem responsável"; o Funcionário não vê esses cards. O Holerite ainda não
// é derivado (ticket próprio), então nenhum cliente pontua aqui.
const admin = adminLocal();
const SUFIXO = `${Date.now()}`.slice(-6);
const COM_RESPONSAVEL = `Func E2E ${SUFIXO} Ltda`;
const SEM_RESPONSAVEL = `Sem Resp E2E ${SUFIXO} Ltda`;
const FUNCIONARIO_RH_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const ids: string[] = [];

test.describe("Acompanhamento dos funcionários do RH", () => {
  test.beforeAll(async () => {
    for (const empresa of [COM_RESPONSAVEL, SEM_RESPONSAVEL]) {
      const id = crypto.randomUUID();
      ids.push(id);
      const criado = await admin
        .from("clientes")
        .insert({ id, empresa, cnpj: cnpjUnico(), regime: "lucro_presumido" });
      if (criado.error) throw criado.error;
    }
    const resp = await admin
      .from("cliente_responsaveis")
      .insert({ cliente_id: ids[0], setor: "rh", responsavel_id: FUNCIONARIO_RH_ID });
    if (resp.error) throw resp.error;
  });

  test.afterAll(async () => {
    await admin.from("clientes").delete().in("id", ids);
  });

  test("Líder abre o card do Funcionário, vê o detalhe e acha o cliente sem Responsável @smoke", async ({
    page,
  }) => {
    await login(page, "lider.rh@rigonicontabil.local", "lider123");
    await expect(page).toHaveURL("/rh");

    await page.getByRole("link", { name: /^Sem responsável/ }).click();
    await expect(page.getByText(SEM_RESPONSAVEL)).toBeVisible();
    await page.goBack();

    const { data: perfil } = await admin
      .from("perfis")
      .select("nome")
      .eq("id", FUNCIONARIO_RH_ID)
      .single();
    await page.getByRole("link", { name: new RegExp(`^${perfil!.nome}`) }).click();

    await expect(page.getByRole("group", { name: "Pendente por serviço" })).toContainText(
      COM_RESPONSAVEL,
    );
    await expect(page.getByRole("group", { name: "Evolução" })).toBeVisible();
  });

  test("Funcionário não vê o gráfico", async ({ page }) => {
    await login(page, "funcionario.rh@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/rh");
    await expect(page.getByText("Acompanhamento dos funcionários")).toHaveCount(0);

    await page.goto("/rh/funcionarios/" + FUNCIONARIO_RH_ID);
    await expect(page).toHaveURL("/");
  });
});
