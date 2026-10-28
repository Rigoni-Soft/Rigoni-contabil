import { expect, test } from "./fixtures";
import { adminLocal } from "./support/admin-local";
import { login } from "./support/criar-cliente";

// Setor Simples Nacional do seed: funcionario.sn (dono), funcionario2.sn (destinatário da espera
// dirigida) e lider.sn (supervisão). Os Atendimentos nascem pela RPC da URA e são ajustados no banco.
const admin = adminLocal();

const FUNCIONARIO_SN = "22222222-2222-2222-2222-222222222222";
const FUNCIONARIO2_SN = "99999999-9999-9999-9999-999999999999";
const TEL_DO_DONO = "61955575001";
const TEL_DIRIGIDO = "61955575002";
const TELEFONES = [TEL_DO_DONO, TEL_DIRIGIDO];

async function abrir(telefone: string, nome: string, texto: string) {
  const cliente = crypto.randomUUID();
  const inserido = await admin.from("clientes").insert({
    id: cliente,
    empresa: `${nome} Ltda`,
    cnpj: `6${telefone}${Date.now()}`.slice(0, 14),
    regime: "simples_nacional",
  });
  if (inserido.error) throw inserido.error;
  const contato = await admin.from("cliente_contatos").insert({
    id: crypto.randomUUID(),
    cliente_id: cliente,
    nome,
    telefone: `(61) ${telefone.slice(2, 7)}-${telefone.slice(7)}`,
    padrao: true,
  });
  if (contato.error) throw contato.error;
  const aberto = await admin.rpc("abrir_atendimento", {
    p_telefone: `55${telefone}`,
    p_chave: telefone,
    p_cliente_id: cliente,
    p_setor: "simples_nacional",
    p_mensagens: [{ autor: "contato", texto, idExterno: `wamid.E2E-SUP-${telefone}` }],
  });
  if (aberto.error) throw aberto.error;
  return cliente;
}

const clientes: string[] = [];

test.describe("Supervisão de Líder/Admin e espera dirigida (#165)", () => {
  test.beforeAll(async () => {
    await admin.from("atendimentos").delete().in("chave_telefone", TELEFONES);
    // A espera é do Setor inteiro: sobras de outras execuções mudariam o que a tela mostra.
    await admin
      .from("atendimentos")
      .delete()
      .eq("setor", "simples_nacional")
      .is("funcionario_id", null);

    clientes.push(await abrir(TEL_DO_DONO, "Dona Do Dono", "Pergunta do cliente do dono"));
    clientes.push(await abrir(TEL_DIRIGIDO, "Dona Dirigida", "Pergunta da espera dirigida"));

    const doDono = await admin
      .from("atendimentos")
      .update({
        funcionario_id: FUNCIONARIO_SN,
        fila_funcionario_id: null,
        fila_desde: null,
        assumido_em: new Date().toISOString(),
      })
      .eq("chave_telefone", TEL_DO_DONO);
    if (doDono.error) throw doDono.error;
    const dirigido = await admin
      .from("atendimentos")
      .update({ fila_funcionario_id: FUNCIONARIO2_SN })
      .eq("chave_telefone", TEL_DIRIGIDO);
    if (dirigido.error) throw dirigido.error;
  });

  test.afterAll(async () => {
    await admin.from("atendimentos").delete().in("chave_telefone", TELEFONES);
    await admin.from("clientes").delete().in("id", clientes);
  });

  test("o Líder lê o Atendimento do dono e a espera dirigida, sem responder nem transferir; só o destinatário assume @smoke", async ({
    browser,
  }) => {
    const lider = await (await browser.newContext()).newPage();
    await login(lider, "lider.sn@rigonicontabil.local", "lider123");
    await expect(lider).toHaveURL("/");
    await lider.goto("/atendimento");

    // Espera dirigida a outro: o card abre a leitura, não assume.
    await lider.getByRole("button", { name: /Ler o atendimento de Dona Dirigida/ }).click();
    await expect(
      lider.getByRole("list", { name: "Mensagens" }).getByText("Pergunta da espera dirigida"),
    ).toBeVisible();
    await expect(lider.getByRole("textbox", { name: "Mensagem ao cliente" })).toHaveCount(0);

    // Atendimento de outro: na seção da equipe, também só leitura, e o painel mantém o Encerrar.
    await lider.getByRole("tab", { name: /Em atendimento/ }).click();
    const equipe = lider.getByRole("list", { name: "Da equipe (somente leitura)" });
    await equipe.getByRole("button", { name: /Dona Do Dono/ }).click();
    await expect(
      lider.getByRole("list", { name: "Mensagens" }).getByText("Pergunta do cliente do dono"),
    ).toBeVisible();
    await expect(lider.getByRole("textbox", { name: "Mensagem ao cliente" })).toHaveCount(0);
    const painel = lider.getByRole("complementary", { name: "Ações do Atendimento" });
    await expect(painel.getByLabel("Setor de destino")).toHaveCount(0);
    await expect(painel.getByRole("button", { name: "Encerrar atendimento" })).toBeVisible();

    // Quem não é o destinatário nem supervisiona só vê o card informativo.
    const dono = await (await browser.newContext()).newPage();
    await login(dono, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(dono).toHaveURL("/");
    await dono.goto("/atendimento");
    await expect(dono.getByText("Dirigido a outro usuário")).toBeVisible();
    await expect(dono.getByRole("button", { name: /Dona Dirigida/ })).toHaveCount(0);

    // O destinatário assume e a conversa abre com o campo de resposta.
    const destinatario = await (await browser.newContext()).newPage();
    await login(destinatario, "funcionario2.sn@rigonicontabil.local", "func123");
    await expect(destinatario).toHaveURL("/");
    await destinatario.goto("/atendimento");
    await destinatario
      .getByRole("button", { name: /Assumir o atendimento de Dona Dirigida/ })
      .click();
    await expect(destinatario.getByRole("textbox", { name: "Mensagem ao cliente" })).toBeVisible();

    const assumido = await admin
      .from("atendimentos")
      .select("funcionario_id")
      .eq("chave_telefone", TEL_DIRIGIDO)
      .single();
    expect(assumido.data?.funcionario_id).toBe(FUNCIONARIO2_SN);
  });
});
