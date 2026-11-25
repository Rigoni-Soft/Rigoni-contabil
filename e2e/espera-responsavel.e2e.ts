import { expect, test } from "./fixtures";
import { adminLocal, limparEsperaSemDonoDoSetor } from "./support/admin-local";
import { login } from "./support/criar-cliente";
import { FUNCIONARIO_FINANCEIRO_ID, FUNCIONARIO2_FINANCEIRO_ID } from "./support/usuarios-do-seed";

const admin = adminLocal();

const ANA = FUNCIONARIO_FINANCEIRO_ID;
const BETO = FUNCIONARIO2_FINANCEIRO_ID;
const TEL_ALFA = "61955576001";
const TEL_BETA = "61955576002";
const TELEFONES = [TEL_ALFA, TEL_BETA];
const clientes: string[] = [];

async function cliente(nome: string, telefone: string, responsavel: string): Promise<string> {
  const id = crypto.randomUUID();
  const criado = await admin.from("clientes").insert({
    id,
    empresa: `${nome} Ltda`,
    cnpj: `4${telefone}${Date.now()}`.slice(0, 14),
    regime: "lucro_presumido",
  });
  if (criado.error) throw criado.error;
  const contato = await admin.from("cliente_contatos").insert({
    id: crypto.randomUUID(),
    cliente_id: id,
    nome,
    telefone: `(61) ${telefone.slice(2, 7)}-${telefone.slice(7)}`,
  });
  if (contato.error) throw contato.error;
  const atribuido = await admin
    .from("cliente_responsaveis")
    .insert({ cliente_id: id, setor: "financeiro", responsavel_id: responsavel });
  if (atribuido.error) throw atribuido.error;
  const aberto = await admin.rpc("abrir_atendimento", {
    p_telefone: `55${telefone}`,
    p_chave: telefone,
    p_cliente_id: id,
    p_setor: "financeiro",
    p_mensagens: [
      { autor: "contato", texto: `Pedido de ${nome}`, idExterno: `wamid.E2E-R-${telefone}` },
    ],
  });
  if (aberto.error) throw aberto.error;
  return id;
}

test.describe("Espera dirigida ao Responsável do Cliente em todo Setor (#165)", () => {
  test.beforeAll(async () => {
    await admin.from("atendimentos").delete().in("chave_telefone", TELEFONES);
    await limparEsperaSemDonoDoSetor(admin, "financeiro");
    clientes.push(await cliente("Dona Alfa Resp", TEL_ALFA, ANA));
    clientes.push(await cliente("Seu Beta Resp", TEL_BETA, BETO));
  });

  test.afterAll(async () => {
    await admin.from("atendimentos").delete().in("chave_telefone", TELEFONES);
    await admin.from("clientes").delete().in("id", clientes);
  });

  test("cada Funcionário só vê o Atendimento do cliente de que é Responsável; outro Setor não vê nenhum @smoke", async ({
    browser,
  }) => {
    const ana = await (await browser.newContext()).newPage();
    await login(ana, "funcionario.financeiro@rigonicontabil.local", "func123");
    await expect(ana).toHaveURL("/");
    await ana.goto("/atendimento");
    await expect(
      ana.getByRole("button", { name: /Assumir o atendimento de Dona Alfa Resp/ }),
    ).toBeVisible();
    await expect(ana.getByText(/Seu Beta Resp/)).toHaveCount(0);

    const beto = await (await browser.newContext()).newPage();
    await login(beto, "funcionario2.financeiro@rigonicontabil.local", "func123");
    await expect(beto).toHaveURL("/");
    await beto.goto("/atendimento");
    await expect(
      beto.getByRole("button", { name: /Assumir o atendimento de Seu Beta Resp/ }),
    ).toBeVisible();
    await expect(beto.getByText(/Dona Alfa Resp/)).toHaveCount(0);

    const sn = await (await browser.newContext()).newPage();
    await login(sn, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(sn).toHaveURL("/simples-nacional");
    await sn.goto("/atendimento");
    await expect(sn.getByText("Nenhum cliente em espera.")).toBeVisible();

    await ana.getByRole("button", { name: /Assumir o atendimento de Dona Alfa Resp/ }).click();
    await expect(ana.getByRole("textbox", { name: "Mensagem ao cliente" })).toBeVisible();
    const dono = await admin
      .from("atendimentos")
      .select("funcionario_id")
      .eq("chave_telefone", TEL_ALFA)
      .single();
    expect(dono.data?.funcionario_id).toBe(ANA);
  });
});
