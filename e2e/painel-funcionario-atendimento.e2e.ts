import { expect, test } from "./fixtures";
import { abrirConversaEmAtendimento } from "./support/abrir-conversa";
import { adminLocal } from "./support/admin-local";
import { login } from "./support/criar-cliente";

// O Atendimento nasce direto no banco, sem passar pela URA/webhook.
const admin = adminLocal();

const FUNCIONARIO = "55555555-5555-5555-5555-555555555555";
const TELEFONE = "61955572001";
const CLIENTE = crypto.randomUUID();
const CNPJ = `6${Date.now()}`.slice(0, 14);

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

    // A conversa abre no centro da tela Atendimento, sem rota própria.
    await abrirConversaEmAtendimento(page, /Dona Painel/);
    await expect(page).toHaveURL("/atendimento");

    await expect(page.getByRole("heading", { name: "Dona Painel" })).toBeVisible();
    await expect(page.getByText("Painel E2E Ltda ·")).toBeVisible();
    const mensagens = page.getByRole("list", { name: "Mensagens" });
    const balaoDoCliente = mensagens
      .getByRole("listitem")
      .filter({ hasText: "Preciso do contrato social" });
    await expect(balaoDoCliente).toContainText("Dona Painel");
    await expect(balaoDoCliente).toContainText("CNPJ");
    const balaoDoAtendente = mensagens.getByRole("listitem").filter({ hasText: "Já te envio" });
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
    await abrirConversaEmAtendimento(page, /Dona Painel/);

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
    await abrirConversaEmAtendimento(page, /Dona Painel/);

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
    await abrirConversaEmAtendimento(page, /Dona Painel/);

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

    await expect(page.getByRole("link", { name: "Visualizar balanco-setembro.pdf" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Baixar balanco-setembro.pdf" })).toBeVisible();

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
    // (reação) a esperam curta; o Storage não fica com os arquivos de teste.
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
    await abrirConversaEmAtendimento(page, /Dona Painel/);

    await page.getByRole("button", { name: "Gravar áudio" }).click();
    await expect(page.getByRole("button", { name: "Enviar áudio" })).toBeVisible();
    await expect(page.getByText(/Gravando: 00:0[1-9]/)).toBeVisible();

    // O foco entra em enviar (Enter envia), o Esc descarta e o foco volta ao microfone.
    await expect(page.getByRole("button", { name: "Enviar áudio" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Gravar áudio" })).toBeFocused();
    await expect(page.getByLabel("Mensagem ao cliente")).toBeVisible();
  });

  test("o Funcionário grava e envia um áudio ao cliente e ele vira balão com player @smoke", async ({
    page,
  }) => {
    await login(page, "funcionario2.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await abrirConversaEmAtendimento(page, /Dona Painel/);

    await page.getByRole("button", { name: "Gravar áudio" }).click();
    await expect(page.getByText(/Gravando: 00:0[1-9]/)).toBeVisible();
    await page.getByRole("button", { name: "Enviar áudio" }).click();

    const player = page.getByLabel(/^Áudio: gravacao\.(ogg|m4a)$/);
    // O Chromium recente grava mp4/AAC (m4a), aceito sem conversão; o webm→ogg é coberto pelo
    // gateway (ffmpeg real) e pelo caso de uso.
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
    await abrirConversaEmAtendimento(page, /Dona Painel/);

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

  test("mensagem nova do cliente soma ao contador do menu na leitura seguinte", async ({
    page,
  }) => {
    await login(page, "funcionario2.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    const menu = page.getByRole("navigation", { name: "Setores" });
    await expect(menu.getByRole("link", { name: "Atendimento", exact: true })).toBeVisible();

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

    // Estímulo determinístico: um carregamento novo lê na hora, sem esperar o ciclo de 15 s do
    // polling (esse é coberto pelo spec do hook). Antes da mensagem o menu não tinha contador.
    await page.reload();
    await expect(menu.getByRole("link", { name: "Atendimento, 1 pendente" })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("o Funcionário transfere o Atendimento a outro Setor, que não oferece o Setor atual nem o Simples Nacional @smoke", async ({
    page,
  }) => {
    await login(page, "funcionario2.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await abrirConversaEmAtendimento(page, /Dona Painel/);

    const painel = page.getByRole("complementary", { name: "Ações do Atendimento" });
    const setores = painel.getByLabel("Setor de destino");
    await expect(setores.locator("option", { hasText: "Financeiro" })).toHaveCount(0);
    // O Cliente de teste é Lucro Presumido: o Simples Nacional não é destino possível.
    await expect(setores.locator("option", { hasText: "Simples Nacional" })).toHaveCount(0);

    await setores.selectOption({ label: "Tributário" });
    await painel.getByLabel("Resumo do assunto").fill("Cliente quer revisar o DAS");
    await painel.getByRole("button", { name: "Transferir" }).click();

    // Transferido, o Funcionário perde a conversa: ela fecha e a aba "Em atendimento" fica vazia.
    await expect(page.getByText("Escolha um atendimento para conversar.")).toBeVisible();
    await expect(page.getByText("Você não tem atendimentos em andamento.")).toBeVisible();
  });
});
