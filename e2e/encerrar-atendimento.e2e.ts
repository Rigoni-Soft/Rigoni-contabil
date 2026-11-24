import { expect, test } from "./fixtures";
import { abrirConversaEmAtendimento } from "./support/abrir-conversa";
import { adminLocal } from "./support/admin-local";
import { login } from "./support/criar-cliente";

const admin = adminLocal();

const FUNCIONARIO = "55555555-5555-5555-5555-555555555555";
const EM_ANDAMENTO = "61955574001";
const NA_FILA = "61955574002";

let atendimentoId: string;
let filaId: string;

test.describe("Encerrar Atendimento", () => {
  test.beforeAll(async () => {
    await admin.from("atendimentos").delete().eq("funcionario_id", FUNCIONARIO);
    await admin.from("atendimentos").delete().in("chave_telefone", [EM_ANDAMENTO, NA_FILA]);
    await admin.from("atendimentos").delete().eq("setor", "financeiro").is("funcionario_id", null);

    const dono = await admin
      .from("atendimentos")
      .insert({
        telefone: `55${EM_ANDAMENTO}`,
        chave_telefone: EM_ANDAMENTO,
        setor: "financeiro",
        funcionario_id: FUNCIONARIO,
        assumido_em: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (dono.error) throw dono.error;
    atendimentoId = dono.data.id;

    const fila = await admin
      .from("atendimentos")
      .insert({
        telefone: `55${NA_FILA}`,
        chave_telefone: NA_FILA,
        setor: "financeiro",
        fila_desde: new Date(Date.now() - 60_000).toISOString(),
      })
      .select("id")
      .single();
    if (fila.error) throw fila.error;
    filaId = fila.data.id;
  });

  test.afterAll(async () => {
    await admin.from("atendimentos").delete().in("chave_telefone", [EM_ANDAMENTO, NA_FILA]);
  });

  test("encerra pelo painel, volta ao início e não atribui o próximo da espera @smoke", async ({
    page,
  }) => {
    await login(page, "funcionario2.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await abrirConversaEmAtendimento(page, /95557-4001/);

    await page.getByRole("button", { name: "Encerrar atendimento" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("cliente será avisado");
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByLabel("Mensagem ao cliente")).toBeVisible();

    await page.getByRole("button", { name: "Encerrar atendimento" }).click();
    await page.getByRole("button", { name: "Confirmar encerramento" }).click();

    await expect(page.getByText("Escolha um atendimento para conversar.")).toBeVisible();
    await expect(page).toHaveURL("/atendimento");

    const encerrado = await admin
      .from("atendimentos")
      .select("status")
      .eq("id", atendimentoId)
      .single();
    expect(encerrado.data?.status).toBe("encerrado");
    const esperando = await admin
      .from("atendimentos")
      .select("funcionario_id, status")
      .eq("id", filaId)
      .single();
    expect(esperando.data).toEqual({ funcionario_id: null, status: "em_andamento" });
    const avisos = await admin
      .from("mensagens")
      .select("texto")
      .eq("atendimento_id", filaId)
      .eq("autor", "ura");
    expect(avisos.data).toEqual([]);
  });
});
