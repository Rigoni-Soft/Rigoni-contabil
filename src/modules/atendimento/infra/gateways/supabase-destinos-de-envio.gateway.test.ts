/**
 * Integração infra ↔ Supabase (testes.md, seção 3) da leitura dos Destinos de envio pelos jobs e do
 * aviso do sino quando o Cliente fica sem meio de envio: tipo específico antes de "todos", telefone
 * com DDI, janela de 24h pela chave nacional, canal removido fora da resolução, e o alerta
 * `contato_ausente` avisando o Líder e o Responsável do Setor (uma vez por abertura, nunca o Admin).
 * Destrutiva: só roda no Supabase local e limpa pelos CNPJs da própria suíte. Requer `npx supabase start`.
 */
import {
  executarRodada,
  SEM_ANDAMENTO,
  semDestinatario,
} from "@/modules/atendimento/application/jobs/alertas-da-rodada";
import { soDigitosNacionais } from "@/shared/kernel/telefone";

import { criarAdminLocal } from "../../../../../test-support/admin-supabase-local";
import {
  criarClienteDeTeste,
  removerClientesDeTeste,
} from "../../../../../test-support/clientes-de-teste";
import { SupabaseAlertaSetorGateway } from "./supabase-alerta-setor.gateway";
import { SupabaseDestinosDeEnvioGateway } from "./supabase-destinos-de-envio.gateway";

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = criarAdminLocal(SERVICE_KEY);
const destinos = new SupabaseDestinosDeEnvioGateway(admin);
const alertas = new SupabaseAlertaSetorGateway(admin, "lembretes");

const ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const LIDER_SN_ID = "88888888-8888-8888-8888-888888888888";
const FUNCIONARIO_SN_ID = "22222222-2222-2222-2222-222222222222";
const LIDER_RH_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const FUNCIONARIO_RH_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const CNPJ_DESTINOS = "11222333000181";
const CNPJ_AVISO_SN = "11444777000161";
const CNPJ_AVISO_RH = "11555888000102";
const CNPJS = [CNPJ_DESTINOS, CNPJ_AVISO_SN, CNPJ_AVISO_RH];

const HORA_MS = 60 * 60 * 1000;
const sufixo = String(Date.now()).slice(-8);

async function ok<T>(consulta: PromiseLike<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

async function criarContato(
  clienteId: string,
  c: { nome: string; telefone?: string; email?: string },
): Promise<string> {
  const id = crypto.randomUUID();
  await ok(
    admin.from("cliente_contatos").insert({
      id,
      cliente_id: clienteId,
      nome: c.nome,
      telefone: c.telefone ?? null,
      email: c.email ?? null,
    }),
  );
  return id;
}

async function criarDestino(
  clienteId: string,
  d: {
    contatoId: string;
    tipo: string | null;
    canal: "whatsapp" | "email" | "whatsapp_e_email";
    setor?: "simples_nacional" | "rh";
  },
) {
  await ok(
    admin.from("destinos_de_envio").insert({
      cliente_id: clienteId,
      setor: d.setor ?? "simples_nacional",
      tipo: d.tipo,
      contato_id: d.contatoId,
      canal: d.canal,
    }),
  );
}

async function criarAtendimentoComMensagens(
  clienteId: string,
  telefone: string,
  mensagens: { autor: string; ha: number }[],
) {
  const criado = await ok(
    admin
      .from("atendimentos")
      .insert({
        telefone,
        chave_telefone: soDigitosNacionais(telefone),
        cliente_id: clienteId,
        setor: "recepcao",
      })
      .select("id")
      .single(),
  );
  await ok(
    admin.from("mensagens").insert(
      mensagens.map((m) => ({
        atendimento_id: criado.id,
        autor: m.autor,
        texto: "teste",
        criado_em: new Date(Date.now() - m.ha).toISOString(),
      })),
    ),
  );
  return criado.id;
}

const atendimentos: string[] = [];

beforeAll(() => removerClientesDeTeste(CNPJS));
afterAll(async () => {
  if (atendimentos.length > 0) {
    await admin.from("atendimentos").delete().in("id", atendimentos);
  }
  await admin.from("cliente_responsaveis").delete().in("responsavel_id", [FUNCIONARIO_SN_ID]);
  await admin
    .from("perfis")
    .update({ desativado_em: null })
    .in("id", [LIDER_SN_ID, LIDER_RH_ID, FUNCIONARIO_SN_ID, FUNCIONARIO_RH_ID]);
  await removerClientesDeTeste(CNPJS);
});

describe("SupabaseDestinosDeEnvioGateway", () => {
  const telefoneMascarado = `(11) 9${sufixo.slice(0, 4)}-${sufixo.slice(4)}`;
  const nacional = soDigitosNacionais(telefoneMascarado);
  let clienteId: string;
  let contatoId: string;

  beforeAll(async () => {
    clienteId = await criarClienteDeTeste(CNPJ_DESTINOS, "simples_nacional");
    contatoId = await criarContato(clienteId, {
      nome: "Ângela Exemplo",
      telefone: telefoneMascarado,
      email: "angela@exemplo.test",
    });
  });

  it("sem Destino cadastrado: lista vazia (o chamador alerta o Setor)", async () => {
    const r = await destinos.resolver(clienteId, "simples_nacional", "das");
    expect(r).toEqual({ ok: true, value: [] });
  });

  it("Destino 'todos os envios': vale para qualquer tipo, com o telefone já com o DDI", async () => {
    await criarDestino(clienteId, { contatoId, tipo: null, canal: "whatsapp" });

    for (const tipo of ["das", "lembrete_documento", "guia_parcelamento"] as const) {
      const r = await destinos.resolver(clienteId, "simples_nacional", tipo);
      expect(r.ok && r.value).toMatchObject([
        {
          contatoNome: "Ângela Exemplo",
          telefone: `55${nacional}`,
          canal: "whatsapp",
          ultimaMensagemDoContatoEm: null,
        },
      ]);
    }
  });

  it("Destino do tipo vale antes do 'todos': o DAS vai a outro Contato, o lembrete segue no 'todos'", async () => {
    const beto = await criarContato(clienteId, {
      nome: "Beto Exemplo",
      email: "beto@exemplo.test",
    });
    await criarDestino(clienteId, { contatoId: beto, tipo: "das", canal: "email" });

    const das = await destinos.resolver(clienteId, "simples_nacional", "das");
    const lembrete = await destinos.resolver(clienteId, "simples_nacional", "lembrete_documento");

    expect(das.ok && das.value.map((d) => [d.contatoNome, d.canal, d.email])).toEqual([
      ["Beto Exemplo", "email", "beto@exemplo.test"],
    ]);
    expect(lembrete.ok && lembrete.value.map((d) => d.contatoNome)).toEqual(["Ângela Exemplo"]);
  });

  it("os Destinos de um Setor não valem para o outro: o RH, sem Destino, fica vazio", async () => {
    const r = await destinos.resolver(clienteId, "rh", "guia_parcelamento");
    expect(r).toEqual({ ok: true, value: [] });
  });

  it("canal removido do Contato: o Destino deixa de valer (some da resolução)", async () => {
    const soEmail = await criarContato(clienteId, {
      nome: "Caio Exemplo",
      email: "caio@exemplo.test",
    });
    await criarDestino(clienteId, {
      contatoId: soEmail,
      tipo: "guia_parcelamento",
      canal: "email",
    });
    await ok(
      admin
        .from("cliente_contatos")
        .update({ email: null, telefone: "11988887777" })
        .eq("id", soEmail),
    );

    const r = await destinos.resolver(clienteId, "simples_nacional", "guia_parcelamento");

    // O tipo específico tem um Destino, mas inválido: nada é entregue e o Setor é alertado.
    expect(r).toEqual({ ok: true, value: [] });
  });

  it("janela de 24h pela chave nacional: a última mensagem do contato, não a da URA", async () => {
    atendimentos.push(
      await criarAtendimentoComMensagens(clienteId, `55${nacional}`, [
        { autor: "contato", ha: HORA_MS },
        { autor: "ura", ha: 60_000 },
      ]),
    );

    const r = await destinos.resolver(clienteId, "simples_nacional", "lembrete_documento");

    const ultima = r.ok ? r.value[0].ultimaMensagemDoContatoEm : null;
    expect(ultima).toBeInstanceOf(Date);
    const idade = Date.now() - ultima!.getTime();
    expect(idade).toBeGreaterThan(HORA_MS - 30_000);
    expect(idade).toBeLessThan(HORA_MS + 30_000);
  });

  it("contato com telefone já com o 55 no cadastro: o telefone de envio não duplica o DDI", async () => {
    const com55 = await criarContato(clienteId, {
      nome: "Dora Exemplo",
      telefone: `5511977776666`,
    });
    await criarDestino(clienteId, { contatoId: com55, tipo: "das", canal: "whatsapp" });

    const r = await destinos.resolver(clienteId, "simples_nacional", "das");

    expect(r.ok && r.value.map((d) => d.telefone)).toContain("5511977776666");
  });
});

describe("aviso do sino: Cliente sem meio de envio", () => {
  const MENSAGEM = "Cliente de Teste Ltda: sem meio de envio para o DAS (Simples Nacional)";

  async function avisos(clienteId: string) {
    const linhas = await ok(
      admin
        .from("avisos_cadastro")
        .select("destinatario_id, tipo, mensagem, cliente_id")
        .eq("cliente_id", clienteId)
        .eq("tipo", "sem_meio_de_envio"),
    );
    return linhas;
  }

  const destinatarios = async (clienteId: string) =>
    (await avisos(clienteId)).map((a) => a.destinatario_id).sort();

  async function abrirAlerta(
    clienteId: string,
    setor: "simples_nacional" | "rh",
    mensagem = MENSAGEM,
  ) {
    const r = await alertas.alertar({ setor, tipo: "contato_ausente", clienteId, mensagem });
    expect(r.ok).toBe(true);
  }

  async function resolverAlertas(clienteId: string) {
    await ok(
      admin
        .from("alertas_setor")
        .update({ resolvido_em: new Date().toISOString() })
        .eq("cliente_id", clienteId)
        .is("resolvido_em", null),
    );
  }

  async function atribuirResponsavel(
    clienteId: string,
    setor: "simples_nacional" | "rh",
    id: string,
  ) {
    await ok(
      admin
        .from("cliente_responsaveis")
        .upsert(
          { cliente_id: clienteId, setor, responsavel_id: id },
          { onConflict: "cliente_id,setor" },
        ),
    );
  }

  let clienteSn: string;
  let clienteRh: string;

  beforeAll(async () => {
    clienteSn = await criarClienteDeTeste(CNPJ_AVISO_SN, "simples_nacional");
    clienteRh = await criarClienteDeTeste(CNPJ_AVISO_RH, "simples_nacional");
    await ok(
      admin
        .from("avisos_cadastro")
        .delete()
        .in("cliente_id", [clienteSn, clienteRh])
        .eq("tipo", "sem_meio_de_envio"),
    );
  });

  it("alerta aberto com Responsável ativo: avisa o Líder e o Responsável do Setor, com o texto do alerta, e nunca o Admin", async () => {
    await atribuirResponsavel(clienteSn, "simples_nacional", FUNCIONARIO_SN_ID);

    await abrirAlerta(clienteSn, "simples_nacional");

    expect(await destinatarios(clienteSn)).toEqual([FUNCIONARIO_SN_ID, LIDER_SN_ID].sort());
    expect(await destinatarios(clienteSn)).not.toContain(ADMIN_ID);
    expect((await avisos(clienteSn)).every((a) => a.mensagem === MENSAGEM)).toBe(true);
  });

  it("renovar o alerta já aberto não avisa de novo (uma vez por abertura)", async () => {
    await abrirAlerta(clienteSn, "simples_nacional", `${MENSAGEM} | outra frase`);
    await abrirAlerta(clienteSn, "simples_nacional");

    expect(await avisos(clienteSn)).toHaveLength(2);
  });

  it("resolvido e reaberto: a condição voltou, e o Líder e o Responsável são avisados de novo", async () => {
    await resolverAlertas(clienteSn);

    await abrirAlerta(clienteSn, "simples_nacional");

    expect(await avisos(clienteSn)).toHaveLength(4);
  });

  it("sem Responsável ativo no Setor: só o Líder é avisado", async () => {
    await resolverAlertas(clienteSn);
    await ok(
      admin
        .from("perfis")
        .update({ desativado_em: new Date().toISOString() })
        .eq("id", FUNCIONARIO_SN_ID),
    );
    const antes = (await avisos(clienteSn)).length;

    await abrirAlerta(clienteSn, "simples_nacional");

    const novos = (await avisos(clienteSn)).slice(antes);
    expect(novos).toHaveLength(1);
    await ok(admin.from("perfis").update({ desativado_em: null }).eq("id", FUNCIONARIO_SN_ID));
  });

  it("alerta do RH avisa o Líder e o Responsável do RH, não os do Simples Nacional", async () => {
    await atribuirResponsavel(clienteRh, "rh", FUNCIONARIO_RH_ID);

    await abrirAlerta(
      clienteRh,
      "rh",
      "Cliente de Teste Ltda: sem meio de envio para a guia de parcelamento (RH)",
    );

    expect(await destinatarios(clienteRh)).toEqual([FUNCIONARIO_RH_ID, LIDER_RH_ID].sort());
  });

  it("alerta de outro tipo (falha de envio) não gera este aviso", async () => {
    await resolverAlertas(clienteSn);
    const antes = (await avisos(clienteSn)).length;

    await alertas.alertar({
      setor: "simples_nacional",
      tipo: "falha_envio",
      clienteId: clienteSn,
      mensagem: "x",
    });

    expect((await avisos(clienteSn)).length).toBe(antes);
  });

  it("Setor sem Líder nem Responsável ativos: o alerta abre e ninguém é avisado no sino", async () => {
    await resolverAlertas(clienteSn);
    const desativar = (ativo: boolean) =>
      ok(
        admin
          .from("perfis")
          .update({ desativado_em: ativo ? null : new Date().toISOString() })
          .in("id", [LIDER_SN_ID, FUNCIONARIO_SN_ID]),
      );
    await desativar(false);
    try {
      const antes = (await avisos(clienteSn)).length;

      await abrirAlerta(clienteSn, "simples_nacional");

      expect((await avisos(clienteSn)).length).toBe(antes);
    } finally {
      await desativar(true);
    }
  });

  it("job sem Destino abre o alerta; cadastrado o Destino, a rodada seguinte o resolve", async () => {
    const sinal = () =>
      ok(
        admin
          .from("alertas_setor")
          .select("resolvido_em")
          .eq("cliente_id", clienteRh)
          .eq("setor", "simples_nacional")
          .eq("tipo", "contato_ausente"),
      );
    // O que o job faz por Cliente: lê os Destinos do Setor e, sem nenhum válido, devolve a ocorrência.
    const rodada = (agora: Date) =>
      executarRodada(alertas, agora, [{ clienteId: clienteRh }], async ({ clienteId }) => {
        const r = await destinos.resolver(clienteId, "simples_nacional", "das");
        const vazio = !r.ok || r.value.length === 0;
        return [
          vazio
            ? semDestinatario("Cliente de Teste Ltda", "simples_nacional", "das")
            : SEM_ANDAMENTO,
        ];
      });

    await rodada(new Date());
    expect(await sinal()).toMatchObject([{ resolvido_em: null }]);

    const contatoId = await criarContato(clienteRh, {
      nome: "Dora Exemplo",
      telefone: "5511977776666",
    });
    await criarDestino(clienteRh, { contatoId, tipo: "das", canal: "whatsapp" });
    // O cadastro não resolve na hora: o alerta segue aberto até a rodada seguinte.
    expect(await sinal()).toMatchObject([{ resolvido_em: null }]);

    await rodada(new Date(Date.now() + 2 * 24 * HORA_MS));
    expect((await sinal())[0].resolvido_em).not.toBeNull();
  });
});
