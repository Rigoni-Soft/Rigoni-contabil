import { expect, test } from "./fixtures";
import { adminLocal } from "./support/admin-local";
import { cnpjUnico, login } from "./support/criar-cliente";

// Líder fora do Simples Nacional atribui, troca e remove o Responsável do Cliente no próprio Setor (#165).
const admin = adminLocal();
const SUFIXO = `${Date.now()}`.slice(-6);
const ANA = `Ana Contábil ${SUFIXO}`;
const BETO = `Beto Contábil ${SUFIXO}`;
const usuarios: string[] = [];
let clienteId = "";

async function funcionarioContabil(nome: string) {
  const email = `${nome.split(" ")[0].toLowerCase()}.${SUFIXO}@rigonicontabil.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "func123",
    email_confirm: true,
  });
  if (error) throw error;
  usuarios.push(data.user.id);
  const perfil = await admin
    .from("perfis")
    .insert({ id: data.user.id, nome, email, papel: "funcionario", setor: "contabil" });
  if (perfil.error) throw perfil.error;
  return data.user.id;
}

async function responsavelGravado() {
  const { data } = await admin
    .from("cliente_responsaveis")
    .select("responsavel_id")
    .eq("cliente_id", clienteId)
    .eq("setor", "contabil")
    .maybeSingle();
  return data?.responsavel_id ?? null;
}

test.describe("Responsável do Setor na tela do Cliente (#165)", () => {
  let ana = "";
  let beto = "";

  test.beforeAll(async () => {
    ana = await funcionarioContabil(ANA);
    beto = await funcionarioContabil(BETO);
    clienteId = crypto.randomUUID();
    const criado = await admin.from("clientes").insert({
      id: clienteId,
      empresa: `Responsavel Setor E2E ${SUFIXO} Ltda`,
      cnpj: cnpjUnico(),
      regime: "lucro_presumido",
    });
    if (criado.error) throw criado.error;
  });

  test.afterAll(async () => {
    await admin.from("clientes").delete().eq("id", clienteId);
    for (const id of usuarios) await admin.auth.admin.deleteUser(id);
  });

  test("Líder Contábil atribui, troca e remove o Responsável do Cliente", async ({ page }) => {
    await login(page, "lider.contabil@rigonicontabil.local", "lider123");
    await expect(page).toHaveURL("/");
    await page.goto(`/clientes/${clienteId}`);

    const campo = page.getByLabel("Responsável", { exact: true });
    const salvar = page.getByRole("button", { name: "Salvar Responsável" });
    // A lista de Funcionários só é buscada quando o Select recebe foco (lazy).
    await campo.focus();

    await campo.selectOption({ label: ANA });
    await salvar.click();
    await expect(page.getByText("Responsável atualizado.")).toBeVisible();
    expect(await responsavelGravado()).toBe(ana);

    await campo.selectOption({ label: BETO });
    await salvar.click();
    await expect.poll(responsavelGravado).toBe(beto);

    await campo.selectOption({ label: "Sem responsável" });
    await salvar.click();
    await expect.poll(responsavelGravado).toBeNull();
  });
});
