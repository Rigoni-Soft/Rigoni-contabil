import { expect, test } from "./fixtures";
import { adminLocal } from "./support/admin-local";
import { cnpjUnico, login } from "./support/criar-cliente";

// Gráfico de acompanhamento dos funcionários do RH: o Líder vê pontos x atribuídos, o detalhe com o cliente
// pendente no serviço que falta e os clientes sem Responsável; o Funcionário não entra. O Holerite ainda não
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

  test("Líder vê o gráfico, abre o detalhe e vê o cliente sem Responsável @smoke", async ({
    page,
  }) => {
    await login(page, "lider.rh@rigonicontabil.local", "lider123");
    await expect(page).toHaveURL("/rh");
    await page.getByRole("link", { name: "Acompanhamento dos funcionários" }).click();

    await expect(page.getByRole("group", { name: "Sem responsável" })).toContainText(
      SEM_RESPONSAVEL,
    );
    const { data: perfil } = await admin
      .from("perfis")
      .select("nome")
      .eq("id", FUNCIONARIO_RH_ID)
      .single();
    await page
      .getByRole("group", { name: "Pontos por funcionário" })
      .getByRole("link", { name: perfil!.nome })
      .click();

    await expect(page.getByRole("group", { name: "Pendente por serviço" })).toContainText(
      COM_RESPONSAVEL,
    );
    await expect(page.getByRole("group", { name: "Evolução" })).toBeVisible();
  });

  test("Funcionário não vê o gráfico", async ({ page }) => {
    await login(page, "funcionario.rh@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/rh");
    await expect(page.getByRole("link", { name: "Acompanhamento dos funcionários" })).toHaveCount(
      0,
    );

    await page.goto("/rh/funcionarios");
    await expect(page).toHaveURL("/rh");
  });
});
