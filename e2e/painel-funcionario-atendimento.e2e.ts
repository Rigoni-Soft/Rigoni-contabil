import { spawnSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

import { expect, test } from "./fixtures";
import { login } from "./support/criar-cliente";

// Painel do Funcionário (#49): o Atendimento em andamento fica visível ao trocar de tela, a
// conversa mostra cada balão com quem escreveu, e o disparo de documento usa o Cliente já
// vinculado. O Atendimento nasce direto no banco (a URA/webhook é outro ticket). Usuário:
// supabase/seed.sql (funcionario2.financeiro), ambiente Dev local.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const FUNCIONARIO = "55555555-5555-5555-5555-555555555555";
const TELEFONE = "61955572001";
const CLIENTE = crypto.randomUUID();
const CNPJ = `6${Date.now()}`.slice(0, 14);
// O Chromium grava webm, que o servidor converte com ffmpeg (docs/adr/0006).
const TEM_FFMPEG = spawnSync(process.env.FFMPEG_PATH || "ffmpeg", ["-version"]).status === 0;

test.describe("Painel do Funcionário (#49)", () => {
  test.beforeAll(async () => {
    await admin.from("atendimentos").delete().eq("funcionario_id", FUNCIONARIO);
    const cliente = await admin
      .from("clientes")
      .insert({ id: CLIENTE, empresa: "Painel E2E Ltda", cnpj: CNPJ, regime: "lucro_presumido" });
    if (cliente.error) throw cliente.error;
    const contato = await admin.from("cliente_contatos").insert({
      id: crypto.randomUUID(),
      cliente_id: CLIENTE,
      nome: "Dona Painel",
      telefone: "(61) 95557-2001",
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
        funcionario_id: FUNCIONARIO,
        assumido_em: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (atendimento.error) throw atendimento.error;
    const mensagens = await admin.from("mensagens").insert([
      {
        atendimento_id: atendimento.data.id,
        autor: "contato",
        texto: "Preciso do contrato social",
        id_externo: "wamid.E2E-PAINEL",
      },
      {
        atendimento_id: atendimento.data.id,
        autor: "funcionario",
        funcionario_id: FUNCIONARIO,
        texto: "Já te envio",
      },
    ]);
    if (mensagens.error) throw mensagens.error;
  });

  test.afterAll(async () => {
    // Por Cliente, não por Funcionário: depois de transferido o Atendimento muda de dono.
    await admin.from("atendimentos").delete().eq("cliente_id", CLIENTE);
    await admin.from("clientes").delete().eq("id", CLIENTE);
  });

  test("o Atendimento fica visível ao trocar de tela e a conversa mostra quem escreveu cada balão @smoke", async ({
    page,
  }) => {
    await login(page, "funcionario2.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");

    const atendimentos = page.getByRole("navigation", { name: "Atendimentos em andamento" });
    await expect(atendimentos.getByRole("link", { name: /Dona Painel/ })).toBeVisible();

    // Navegação do cliente (sem recarregar): o Atendimento não some ao trocar de tela.
    await page.getByRole("link", { name: "Meu perfil" }).click();
    await expect(page).toHaveURL("/perfil");
    await expect(atendimentos.getByRole("link", { name: /Dona Painel/ })).toBeVisible();

    await atendimentos.getByRole("link", { name: /Dona Painel/ }).click();
    await expect(page).toHaveURL(/\/atendimento\/[0-9a-f-]{36}$/);

    await expect(page.getByRole("heading", { name: "Dona Painel" })).toBeVisible();
    await expect(page.getByText("Painel E2E Ltda ·")).toBeVisible();
    const balaoDoCliente = page
      .getByRole("listitem")
      .filter({ hasText: "Preciso do contrato social" });
    await expect(balaoDoCliente).toContainText("Dona Painel");
    await expect(balaoDoCliente).toContainText("CNPJ");
    const balaoDoAtendente = page.getByRole("listitem").filter({ hasText: "Já te envio" });
    await expect(balaoDoAtendente).toContainText("Segundo Funcionário Financeiro · Financeiro");

    // Em tela larga a página não rola em nenhum sentido: só a lista de mensagens rola.
    const transborda = await page.evaluate(() => ({
      vertical: document.documentElement.scrollHeight > window.innerHeight,
      horizontal: document.documentElement.scrollWidth > window.innerWidth,
    }));
    expect(transborda).toEqual({ vertical: false, horizontal: false });

    // O Cliente está vinculado: o disparo oferece o documento sem pedir o CNPJ de novo.
    await expect(page.getByRole("heading", { name: "Serviços do cliente" })).toBeVisible();
  });

  test("o Funcionário responde ao cliente pelo campo da conversa e a resposta vira balão @smoke", async ({
    page,
  }) => {
    await login(page, "funcionario2.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await page
      .getByRole("navigation", { name: "Atendimentos em andamento" })
      .getByRole("link")
      .click();

    const campo = page.getByLabel("Mensagem ao cliente");
    await campo.fill("Bom dia, Dona Painel! Já estou vendo.");
    await campo.press("Enter");

    const balao = page
      .getByRole("listitem")
      .filter({ hasText: "Bom dia, Dona Painel! Já estou vendo." });
    await expect(balao).toContainText("Segundo Funcionário Financeiro · Financeiro");
    await expect(campo).toHaveValue("");
  });

  test("o Funcionário insere um emoji pelo seletor e a mensagem com emoji vira balão @smoke", async ({
    page,
  }) => {
    await login(page, "funcionario2.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await page
      .getByRole("navigation", { name: "Atendimentos em andamento" })
      .getByRole("link")
      .click();

    const campo = page.getByLabel("Mensagem ao cliente");
    await campo.fill("Recebido");
    await page.getByRole("button", { name: "Inserir emoji" }).click();
    await page.getByRole("button", { name: "Joinha" }).click();
    await expect(campo).toHaveValue("Recebido👍");
    await campo.press("Enter");

    await expect(page.getByRole("listitem").filter({ hasText: "Recebido👍" })).toBeVisible();
    await expect(campo).toHaveValue("");
  });

  test("o Funcionário envia uma imagem e um PDF ao cliente pelo clipe e os anexos viram balão @smoke", async ({
    page,
  }) => {
    await login(page, "funcionario2.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await page
      .getByRole("navigation", { name: "Atendimentos em andamento" })
      .getByRole("link")
      .click();

    const campo = page.getByLabel("Mensagem ao cliente");
    const clipe = page.getByLabel("Anexar arquivo");

    // Imagem: a prévia mostra o arquivo, o texto digitado vira a legenda e o campo esvazia.
    await clipe.setInputFiles({
      name: "foto-fachada.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    await expect(page.getByRole("button", { name: "Remover foto-fachada.png" })).toBeVisible();
    await campo.fill("Foto da fachada");
    await page.getByRole("button", { name: "Enviar arquivo" }).click();

    const balaoDaImagem = page.getByRole("listitem").filter({ hasText: "Foto da fachada" });
    await expect(
      balaoDaImagem.getByRole("button", { name: "Ampliar foto-fachada.png" }),
    ).toBeVisible();
    await expect(balaoDaImagem).toContainText("Segundo Funcionário Financeiro · Financeiro");
    // A conversa mostra a miniatura reduzida (WebP) e só baixa o original ao ampliar.
    await expect(
      balaoDaImagem.getByRole("button", { name: "Ampliar foto-fachada.png" }).locator("img"),
    ).toHaveAttribute("src", /miniatura\.webp/);
    await expect(page.getByRole("button", { name: "Remover foto-fachada.png" })).toHaveCount(0);
    await expect(campo).toHaveValue("");

    // Ampliar: o diálogo abre com o botão de fechar à vista, e fechar devolve a conversa.
    await balaoDaImagem.getByRole("button", { name: "Ampliar foto-fachada.png" }).click();
    const fechar = page.getByRole("button", { name: "Fechar imagem" });
    await expect(
      page.getByRole("dialog", { name: "Imagem ampliada: foto-fachada.png" }),
    ).toBeVisible();
    await expect(fechar).toBeFocused();
    await expect(fechar).toBeInViewport();
    await fechar.click();
    await expect(page.getByRole("dialog", { name: /Imagem ampliada/ })).toBeHidden();

    // PDF sem legenda: balão com nome, tamanho e link para baixar.
    await clipe.setInputFiles({
      name: "balanco-setembro.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 %%EOF"),
    });
    await page.getByRole("button", { name: "Enviar arquivo" }).click();

    const link = page.getByRole("link", { name: /balanco-setembro\.pdf/ });
    await expect(link).toBeVisible();
    await expect(link).toContainText("Baixar");

    // Arrastar um arquivo sobre a conversa acende a moldura; soltar o põe na prévia do campo.
    const conversa = page.getByRole("log", { name: "Conversa" });
    const transferencia = await page.evaluateHandle(() => {
      const dados = new DataTransfer();
      dados.items.add(new File(["x"], "planilha.csv", { type: "text/csv" }));
      return dados;
    });
    await conversa.dispatchEvent("dragenter", { dataTransfer: transferencia });
    await expect(page.getByText("Solte para anexar")).toBeVisible();
    await conversa.dispatchEvent("drop", { dataTransfer: transferencia });
    await expect(page.getByText("Solte para anexar")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Remover planilha.csv" })).toBeVisible();
    await page.getByRole("button", { name: "Remover planilha.csv" }).click();

    // Tipo não aceito é recusado com mensagem clara e nada é anexado.
    await clipe.setInputFiles({
      name: "script.html",
      mimeType: "text/html",
      buffer: Buffer.from("<script>alert(1)</script>"),
    });
    await expect(page.getByText("Tipo de arquivo não aceito")).toBeVisible();
    await expect(page.getByRole("button", { name: "Remover script.html" })).toHaveCount(0);

    // Limpa o que o teste criou: os balões com mídia alongam a conversa e os testes seguintes
    // (reação, dock) a esperam curta; o Storage não fica com os arquivos de teste.
    const anexos = await admin
      .from("mensagens")
      .select("id, anexo_caminho, atendimentos!inner(cliente_id)")
      .eq("atendimentos.cliente_id", CLIENTE)
      .not("anexo_tipo", "is", null);
    if (anexos.error) throw anexos.error;
    await admin.storage
      .from("anexos-atendimento")
      .remove(anexos.data.map((m) => m.anexo_caminho as string));
    await admin
      .from("mensagens")
      .delete()
      .in(
        "id",
        anexos.data.map((m) => m.id),
      );
  });

  test("o Funcionário grava um áudio, vê o cronômetro e cancelar descarta sem enviar nada @smoke", async ({
    page,
  }) => {
    await login(page, "funcionario2.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await page
      .getByRole("navigation", { name: "Atendimentos em andamento" })
      .getByRole("link")
      .click();

    await page.getByRole("button", { name: "Gravar áudio" }).click();
    await expect(page.getByRole("button", { name: "Enviar áudio" })).toBeVisible();
    await expect(page.getByText(/Gravando: 00:0[1-9]/)).toBeVisible();

    await page.getByRole("button", { name: "Cancelar gravação" }).click();
    await expect(page.getByRole("button", { name: "Gravar áudio" })).toBeVisible();
    await expect(page.getByLabel("Mensagem ao cliente")).toBeVisible();
  });

  test("o Funcionário grava e envia um áudio ao cliente e ele vira balão com player @smoke", async ({
    page,
  }) => {
    test.skip(!TEM_FFMPEG, "o Chromium grava webm e a conversão para ogg exige ffmpeg");
    await login(page, "funcionario2.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await page
      .getByRole("navigation", { name: "Atendimentos em andamento" })
      .getByRole("link")
      .click();

    await page.getByRole("button", { name: "Gravar áudio" }).click();
    await expect(page.getByText(/Gravando: 00:0[1-9]/)).toBeVisible();
    await page.getByRole("button", { name: "Enviar áudio" }).click();

    const player = page.getByLabel(/^Áudio: gravacao\.ogg$/);
    await expect(player).toBeVisible();
    await expect(page.getByRole("button", { name: "Gravar áudio" })).toBeVisible();

    // Limpa o que o teste criou, como o teste dos anexos.
    const anexos = await admin
      .from("mensagens")
      .select("id, anexo_caminho, atendimentos!inner(cliente_id)")
      .eq("atendimentos.cliente_id", CLIENTE)
      .eq("anexo_tipo", "audio");
    if (anexos.error) throw anexos.error;
    await admin.storage
      .from("anexos-atendimento")
      .remove(anexos.data.map((m) => m.anexo_caminho as string));
    await admin
      .from("mensagens")
      .delete()
      .in(
        "id",
        anexos.data.map((m) => m.id),
      );
  });

  test("o Funcionário reage com emoji à mensagem do cliente e a reação aparece no balão @smoke", async ({
    page,
  }) => {
    await login(page, "funcionario2.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await page
      .getByRole("navigation", { name: "Atendimentos em andamento" })
      .getByRole("link")
      .click();

    await page.getByRole("button", { name: "Reagir à mensagem de Dona Painel" }).click();
    await page
      .getByRole("group", { name: "Emojis da reação" })
      .getByRole("button", { name: "Joinha" })
      .click();

    await expect(page.getByRole("img", { name: "Reação do escritório: 👍" })).toBeVisible();
    // Escolher o mesmo emoji de novo remove a reação.
    await page.getByRole("button", { name: "Reagir à mensagem de Dona Painel" }).click();
    await page
      .getByRole("group", { name: "Emojis da reação" })
      .getByRole("button", { name: "Joinha" })
      .click();
    await expect(page.getByRole("img", { name: "Reação do escritório: 👍" })).toHaveCount(0);
  });

  test("mensagem nova do cliente, com o Funcionário em outra tela, aparece no dock com prévia e destaque", async ({
    page,
  }) => {
    await login(page, "funcionario2.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await page.getByRole("link", { name: "Meu perfil" }).click();
    await expect(page).toHaveURL("/perfil");

    const atendimento = await admin
      .from("atendimentos")
      .select("id")
      .eq("cliente_id", CLIENTE)
      .single();
    if (atendimento.error) throw atendimento.error;
    const nova = await admin.from("mensagens").insert({
      atendimento_id: atendimento.data.id,
      autor: "contato",
      texto: "Chegou outra dúvida sobre o contrato",
    });
    if (nova.error) throw nova.error;

    // O dock consulta a cada 15 s: a prévia e o destaque aparecem sem sair da tela.
    const cartao = page
      .getByRole("navigation", { name: "Atendimentos em andamento" })
      .getByRole("link", { name: /Dona Painel/ });
    await expect(cartao).toContainText("Chegou outra dúvida sobre o contrato", { timeout: 30_000 });
    await expect(cartao).toContainText("nova mensagem");
  });

  test("o Funcionário transfere o Atendimento a outro Setor, que não oferece o Setor atual nem o Simples Nacional @smoke", async ({
    page,
  }) => {
    await login(page, "funcionario2.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await page
      .getByRole("navigation", { name: "Atendimentos em andamento" })
      .getByRole("link")
      .click();

    const painel = page.getByRole("complementary", { name: "Ações do Atendimento" });
    const setores = painel.getByLabel("Setor de destino");
    await expect(setores.locator("option", { hasText: "Financeiro" })).toHaveCount(0);
    // O Cliente de teste é Lucro Presumido: o Simples Nacional não é destino possível.
    await expect(setores.locator("option", { hasText: "Simples Nacional" })).toHaveCount(0);

    await setores.selectOption({ label: "Tributário" });
    await painel.getByLabel("Resumo do assunto").fill("Cliente quer revisar o DAS");
    await painel.getByRole("button", { name: "Transferir" }).click();

    // Transferido, o Funcionário perde a conversa: a tela sai dela e o Atendimento some do dock.
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("navigation", { name: "Atendimentos em andamento" })).toHaveCount(
      0,
    );
  });
});
