import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { NovaMensagem } from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type { AnexarMensagemOutput } from "@/modules/atendimento/application/ports/in/anexar-mensagem-atendimento.provider";
import type { DadosDoContato } from "@/modules/atendimento/application/ports/in/transferir-atendimento.provider";
import type {
  AtendimentoAssumido,
  AtendimentoDoFuncionario,
  AtendimentoEmAndamento,
  AtendimentoParaInatividade,
  AtendimentoRepositoryPort,
  ConversaLida,
  EncerramentoPendente,
  FuncionarioDoSetor,
  ItemDaFila,
  MensagemParaReacao,
  NovaTransferencia,
  NovoAtendimento,
  ResultadoAbertura,
  ResultadoEncerramento,
  ResultadoEncerramentoPorInatividade,
  ResultadoTransferencia,
  RoteamentoDoCliente,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { Inativo } from "@/modules/atendimento/domain/services/inatividade.service";
import {
  aberturaRowSchema,
  anexoRowSchema,
  atendimentoDoFuncionarioRowSchema,
  atendimentoEmAndamentoRowSchema,
  conversaRowSchema,
  encerramentoPendenteRowSchema,
  encerramentoPorInatividadeRowSchema,
  encerramentoRowSchema,
  filaRowSchema,
  inatividadeRowSchema,
  liderRowSchema,
  mensagemParaReacaoRowSchema,
  posicaoRowSchema,
  roteamentoDoClienteRowSchema,
  transferenciaRowSchema,
} from "@/modules/atendimento/infra/dtos/atendimento-rpc-row.dto";
import { funcionarioDoSetorRowSchema } from "@/modules/atendimento/infra/dtos/funcionario-do-setor-row.dto";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

const PAGINA = 1000;

// Usa o client service_role (docs/adr/0001); a tabela não tem policy para usuário logado.
export class SupabaseAtendimentoRepository implements AtendimentoRepositoryPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async funcionariosDoSetor(setor: SetorSlug): Promise<Result<FuncionarioDoSetor[], AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("funcionarios_do_setor", {
      p_setor: setor,
    });
    if (error) return err(new ServicoExternoError("Falha ao consultar os Funcionários do Setor."));
    return ok(
      z
        .array(funcionarioDoSetorRowSchema)
        .parse(data)
        .map((linha) => ({
          id: linha.id,
          atendimentosNoMes: linha.atendimentos_no_mes,
          livre: linha.livre,
        })),
    );
  }

  async abrir(atendimento: NovoAtendimento): Promise<Result<ResultadoAbertura, AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("abrir_atendimento", {
      p_telefone: atendimento.telefone,
      p_chave: atendimento.chave,
      p_cliente_id: atendimento.clienteId,
      p_setor: atendimento.setor,
      p_funcionario_id: atendimento.funcionarioId,
      p_mensagens: atendimento.mensagens,
      p_atribuir_livre: atendimento.atribuirLivreSeVazia ?? false,
      p_resumo: atendimento.resumo ?? null,
      p_cnpj_informado: atendimento.cnpjInformado ?? null,
    });
    if (error) return err(new ServicoExternoError("Falha ao abrir o Atendimento."));
    const linha = aberturaRowSchema.parse(data);
    return ok(
      linha
        ? {
            status: "aberto",
            id: linha.id,
            funcionarioId: linha.funcionario_id,
            promovido: assumido(linha.promovido),
          }
        : { status: "conflito" },
    );
  }

  async anexarMensagem(
    chave: string,
    mensagem: NovaMensagem,
  ): Promise<Result<AnexarMensagemOutput, AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("anexar_mensagem_atendimento", {
      p_chave: chave,
      p_autor: mensagem.autor,
      p_texto: mensagem.texto,
      p_id_externo: mensagem.idExterno ?? null,
    });
    if (error) return err(new ServicoExternoError("Falha ao registrar a Mensagem."));
    return ok({ anexada: anexoRowSchema.parse(data) });
  }

  async buscarEmAndamento(id: string): Promise<Result<AtendimentoEmAndamento | null, AppError>> {
    const { data, error } = await this.supabaseAdmin
      .from("atendimentos")
      .select(
        "id, cliente_id, setor, funcionario_id, telefone, chave_telefone, aviso_inatividade_em",
      )
      .eq("id", id)
      .eq("status", "em_andamento")
      .maybeSingle();
    if (error) return err(new ServicoExternoError("Falha ao consultar o Atendimento."));
    if (!data) return ok(null);
    const linha = atendimentoEmAndamentoRowSchema.parse(data);
    return ok({
      id: linha.id,
      clienteId: linha.cliente_id,
      setor: linha.setor,
      funcionarioId: linha.funcionario_id,
      telefone: linha.telefone,
      chave: linha.chave_telefone,
      emAvisoDeInatividade: linha.aviso_inatividade_em !== null,
    });
  }

  async roteamentoDoCliente(
    clienteId: string,
  ): Promise<Result<RoteamentoDoCliente | null, AppError>> {
    const { data, error } = await this.supabaseAdmin
      .from("clientes")
      .select("regime, cliente_cadastro_operacional_sn(responsavel_id)")
      .eq("id", clienteId)
      .maybeSingle();
    if (error) return err(new ServicoExternoError("Falha ao consultar o Cliente."));
    if (!data) return ok(null);
    const linha = roteamentoDoClienteRowSchema.parse(data);
    const responsavelId = linha.cliente_cadastro_operacional_sn?.responsavel_id ?? null;
    if (!responsavelId) return ok({ regime: linha.regime, responsavelId: null });
    // Responsável desativado não recebe: o Atendimento cai no Líder (#58).
    const ativo = await this.supabaseAdmin
      .from("perfis")
      .select("id")
      .eq("id", responsavelId)
      .is("desativado_em", null)
      .maybeSingle();
    if (ativo.error) return err(new ServicoExternoError("Falha ao consultar o Responsável."));
    return ok({ regime: linha.regime, responsavelId: ativo.data ? responsavelId : null });
  }

  // Cada Setor tem um só Líder (regra de domínio); se o banco devolver dois, falha em vez de escolher.
  async liderDoSetor(setor: SetorSlug): Promise<Result<string | null, AppError>> {
    const { data, error } = await this.supabaseAdmin
      .from("perfis")
      .select("id")
      .eq("setor", setor)
      .eq("papel", "lider_setor")
      .is("desativado_em", null)
      .maybeSingle();
    if (error) return err(new ServicoExternoError("Falha ao consultar o Líder do Setor."));
    return ok(data ? liderRowSchema.parse(data).id : null);
  }

  async transferir(
    transferencia: NovaTransferencia,
  ): Promise<Result<ResultadoTransferencia, AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("transferir_atendimento", {
      p_atendimento_id: transferencia.atendimentoId,
      p_origem_funcionario_id: transferencia.origemFuncionarioId,
      p_setor_destino: transferencia.setorDestino,
      p_funcionario_destino_id: transferencia.funcionarioDestinoId,
      p_resumo: transferencia.resumo,
      p_ator: transferencia.ator.id,
      p_ator_setor: transferencia.ator.setor,
      p_setor_origem: transferencia.setorOrigem,
      p_enfileirar_se_ocupado: transferencia.enfileirarSeOcupado,
      p_atribuir_livre: transferencia.atribuirLivreSeVazia ?? false,
    });
    if (error) return err(new ServicoExternoError("Falha ao transferir o Atendimento."));
    const linha = transferenciaRowSchema.parse(data);
    if (linha.status !== "transferido") return ok(linha);
    return ok({
      status: "transferido",
      naFila: linha.na_fila,
      proximoDaOrigem: assumido(linha.proximo_da_origem),
      promovidoNoDestino: assumido(linha.promovido),
      destinatarioNome: linha.destinatario_nome,
      origemNome: linha.origem_nome,
      contato: { contatoNome: linha.contato_nome, empresa: linha.empresa, cnpj: linha.cnpj },
    });
  }

  async posicaoNaFila(atendimentoId: string): Promise<Result<number | null, AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("posicao_na_fila", {
      p_atendimento_id: atendimentoId,
    });
    if (error) return err(new ServicoExternoError("Falha ao consultar a posição na Fila."));
    const posicao = posicaoRowSchema.parse(data);
    return ok(posicao === 0 ? null : posicao);
  }

  async filaDoSetor(setor: SetorSlug): Promise<Result<ItemDaFila[], AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("fila_do_setor", { p_setor: setor });
    if (error) return err(new ServicoExternoError("Falha ao consultar a Fila do Setor."));
    return ok(
      z
        .array(filaRowSchema)
        .parse(data)
        .map((linha) => ({
          id: linha.id,
          posicao: linha.posicao,
          filaFuncionarioId: linha.fila_funcionario_id,
          filaDesde: new Date(linha.fila_desde),
          telefone: linha.telefone,
          contato: { contatoNome: linha.contato_nome, empresa: linha.empresa, cnpj: linha.cnpj },
          resumo: linha.resumo,
        })),
    );
  }

  encerrar(
    atendimentoId: string,
    funcionarioId: string | null,
    ator: { id: string; setor: SetorSlug },
  ): Promise<Result<ResultadoEncerramento, AppError>> {
    return this.chamarEncerramento("encerrar_atendimento", atendimentoId, funcionarioId, ator);
  }

  encerrarPorInatividade(
    atendimentoId: string,
    funcionarioId: string,
    ator: { id: string; setor: SetorSlug },
    textoFinal: string,
  ): Promise<Result<ResultadoEncerramentoPorInatividade, AppError>> {
    return this.chamar("encerrar_atendimento_por_inatividade", atendimentoId, funcionarioId, ator, {
      p_texto_final: textoFinal,
    }).then((r) => {
      if (!r.ok) return r;
      const linha = encerramentoPorInatividadeRowSchema.parse(r.value);
      if (linha.status === "inexistente") return ok(linha);
      return ok({
        status: "encerrado" as const,
        proximo: assumido(linha.proximo),
        reivindicacao: linha.reivindicacao,
      });
    });
  }

  private async chamarEncerramento(
    rpc: "encerrar_atendimento",
    atendimentoId: string,
    funcionarioId: string | null,
    ator: { id: string; setor: SetorSlug },
  ): Promise<Result<ResultadoEncerramento, AppError>> {
    const resposta = await this.chamar(rpc, atendimentoId, funcionarioId, ator, {});
    if (!resposta.ok) return resposta;
    const linha = encerramentoRowSchema.parse(resposta.value);
    if (linha.status === "inexistente") return ok(linha);
    return ok({ status: "encerrado", proximo: assumido(linha.proximo) });
  }

  // Chamada comum das RPCs de encerramento; devolve o jsonb cru para quem a interpreta.
  private async chamar(
    rpc: "encerrar_atendimento" | "encerrar_atendimento_por_inatividade",
    atendimentoId: string,
    funcionarioId: string | null,
    ator: { id: string; setor: SetorSlug },
    extra: { p_texto_final?: string },
  ): Promise<Result<unknown, AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc(rpc, {
      p_atendimento_id: atendimentoId,
      p_funcionario_id: funcionarioId,
      p_ator: ator.id,
      p_ator_setor: ator.setor,
      ...extra,
    });
    if (error) return err(new ServicoExternoError("Falha ao encerrar o Atendimento."));
    return ok(data);
  }

  // O PostgREST corta cada resposta (1000 linhas por padrão): lê em páginas até acabar.
  async paraInatividade(): Promise<Result<AtendimentoParaInatividade[], AppError>> {
    const paraData = (valor: string | null) => (valor ? new Date(valor) : null);
    const lidos: AtendimentoParaInatividade[] = [];
    for (let de = 0; ; de += PAGINA) {
      const { data, error } = await this.supabaseAdmin
        .rpc("atendimentos_para_inatividade")
        .range(de, de + PAGINA - 1);
      const linhas = z.array(inatividadeRowSchema).safeParse(data);
      if (error || !linhas.success) {
        return err(new ServicoExternoError("Falha ao consultar a inatividade."));
      }
      for (const linha of linhas.data) {
        lidos.push({
          id: linha.id,
          setor: linha.setor,
          funcionarioId: linha.funcionario_id,
          telefone: linha.telefone,
          chave: linha.chave_telefone,
          ultimaDoContato: paraData(linha.ultima_do_contato),
          ultimaDoFuncionario: paraData(linha.ultima_do_funcionario),
          aviso:
            linha.aviso_inatividade_em && linha.aviso_inatividade_de
              ? { em: new Date(linha.aviso_inatividade_em), de: linha.aviso_inatividade_de }
              : null,
          avisoEntregue: linha.aviso_entregue_em !== null,
        });
      }
      if (linhas.data.length < PAGINA) return ok(lidos);
    }
  }

  async marcarAvisoInatividade(
    atendimentoId: string,
    de: Inativo,
    vistoAte: Date,
  ): Promise<Result<boolean, AppError>> {
    return this.rpcBooleana(
      "marcar_aviso_inatividade",
      { p_atendimento_id: atendimentoId, p_de: de, p_visto_ate: vistoAte.toISOString() },
      "Falha ao marcar o aviso de inatividade.",
    );
  }

  async confirmarAvisoEntregue(atendimentoId: string): Promise<Result<boolean, AppError>> {
    return this.rpcBooleana(
      "confirmar_aviso_entregue",
      { p_atendimento_id: atendimentoId },
      "Falha ao confirmar a entrega do aviso de inatividade.",
    );
  }

  async confirmarEncerramentoEntregue(
    atendimentoId: string,
    reivindicacao: string,
  ): Promise<Result<boolean, AppError>> {
    return this.rpcBooleana(
      "confirmar_encerramento_entregue",
      { p_atendimento_id: atendimentoId, p_reivindicacao: reivindicacao },
      "Falha ao confirmar a entrega do encerramento.",
    );
  }

  async reivindicarEncerramentosPendentes(
    limite: number,
  ): Promise<Result<EncerramentoPendente[], AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("reivindicar_encerramentos_pendentes", {
      p_limite: limite,
    });
    const linhas = z.array(encerramentoPendenteRowSchema).safeParse(data);
    if (error || !linhas.success) {
      return err(new ServicoExternoError("Falha ao consultar os encerramentos pendentes."));
    }
    return ok(
      linhas.data.flatMap((l) =>
        l.texto
          ? [
              {
                atendimentoId: l.id,
                telefone: l.telefone,
                texto: l.texto,
                reivindicacao: l.reivindicacao,
              },
            ]
          : [],
      ),
    );
  }

  async liberarEncerramentoPendente(
    atendimentoId: string,
    reivindicacao: string,
  ): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin.rpc("liberar_encerramento_pendente", {
      p_atendimento_id: atendimentoId,
      p_reivindicacao: reivindicacao,
    });
    if (error) return err(new ServicoExternoError("Falha ao liberar o encerramento pendente."));
    return ok(undefined);
  }

  private async rpcBooleana(
    rpc: string,
    args: Record<string, unknown>,
    falha: string,
  ): Promise<Result<boolean, AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc(rpc, args);
    if (error) return err(new ServicoExternoError(falha));
    const resposta = z.boolean().safeParse(data);
    if (!resposta.success) return err(new ServicoExternoError(`Resposta inesperada: ${falha}`));
    return ok(resposta.data);
  }

  async limparAvisoInatividade(atendimentoId: string): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin
      .from("atendimentos")
      .update({ aviso_inatividade_em: null, aviso_inatividade_de: null, aviso_entregue_em: null })
      .eq("id", atendimentoId);
    if (error) return err(new ServicoExternoError("Falha ao limpar o aviso de inatividade."));
    return ok(undefined);
  }

  async emAndamentoDoFuncionario(
    funcionarioId: string,
  ): Promise<Result<AtendimentoDoFuncionario[], AppError>> {
    const { data, error } = await this.supabaseAdmin
      .from("atendimentos")
      .select(
        "id, telefone, chave_telefone, criado_em, clientes(empresa, cnpj, cliente_contatos(nome, telefone, padrao, criado_em)), mensagens(autor, texto, criado_em)",
      )
      .order("criado_em", { referencedTable: "mensagens", ascending: false })
      .limit(1, { referencedTable: "mensagens" })
      .eq("funcionario_id", funcionarioId)
      .eq("status", "em_andamento")
      .order("assumido_em")
      .order("id");
    if (error) return err(new ServicoExternoError("Falha ao consultar os Atendimentos."));
    return ok(
      z
        .array(atendimentoDoFuncionarioRowSchema)
        .parse(data)
        .map((linha) => ({
          id: linha.id,
          telefone: linha.telefone,
          criadoEm: linha.criado_em,
          contato: dadosDoContato(linha.clientes, linha.chave_telefone),
          ultimaMensagem: linha.mensagens[0]
            ? {
                autor: linha.mensagens[0].autor,
                texto: linha.mensagens[0].texto,
                criadoEm: linha.mensagens[0].criado_em,
              }
            : null,
        })),
    );
  }

  async conversa(atendimentoId: string): Promise<Result<ConversaLida | null, AppError>> {
    const { data, error } = await this.supabaseAdmin
      .from("atendimentos")
      .select(
        "id, status, setor, funcionario_id, cliente_id, telefone, chave_telefone, resumo_ura, cnpj_informado, aviso_inatividade_em, aviso_inatividade_de, clientes(empresa, cnpj, cliente_contatos(nome, telefone, padrao, criado_em)), mensagens(id, autor, texto, criado_em, id_externo, reacao, perfis(nome, setor)), transferencias(setor_origem, resumo, origem:perfis!funcionario_origem_id(nome))",
      )
      .eq("id", atendimentoId)
      .order("criado_em", { referencedTable: "mensagens" })
      .order("criado_em", { referencedTable: "transferencias", ascending: false })
      .order("id", { referencedTable: "transferencias", ascending: false })
      .limit(1, { referencedTable: "transferencias" })
      .order("id", { referencedTable: "mensagens" })
      .maybeSingle();
    if (error) return err(new ServicoExternoError("Falha ao consultar o Atendimento."));
    if (!data) return ok(null);
    const linha = conversaRowSchema.parse(data);
    const [ultima] = linha.transferencias;
    return ok({
      id: linha.id,
      status: linha.status,
      setor: linha.setor,
      funcionarioId: linha.funcionario_id,
      clienteId: linha.cliente_id,
      telefone: linha.telefone,
      contato: dadosDoContato(linha.clientes, linha.chave_telefone),
      mensagens: linha.mensagens.map((m) => ({
        id: m.id,
        autor: m.autor,
        texto: m.texto,
        criadoEm: m.criado_em,
        atendente: m.perfis ? { nome: m.perfis.nome, setor: m.perfis.setor } : null,
        idExterno: m.id_externo,
        reacao: m.reacao,
      })),
      ultimaTransferencia: ultima
        ? {
            setorOrigem: ultima.setor_origem,
            origemNome: ultima.origem?.nome ?? null,
            resumo: ultima.resumo,
          }
        : null,
      ura:
        linha.resumo_ura || linha.cnpj_informado
          ? { resumo: linha.resumo_ura, cnpjInformado: linha.cnpj_informado }
          : null,
      aviso:
        linha.aviso_inatividade_em && linha.aviso_inatividade_de
          ? { em: linha.aviso_inatividade_em, de: linha.aviso_inatividade_de }
          : null,
    });
  }

  async registrarMensagemDoFuncionario(
    atendimentoId: string,
    funcionarioId: string,
    texto: string,
  ): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin.from("mensagens").insert({
      atendimento_id: atendimentoId,
      autor: "funcionario",
      funcionario_id: funcionarioId,
      texto,
    });
    if (error) return err(new ServicoExternoError("Falha ao registrar a Mensagem."));
    return ok(undefined);
  }
  async mensagemParaReacao(
    atendimentoId: string,
    mensagemId: string,
  ): Promise<Result<MensagemParaReacao | null, AppError>> {
    const { data, error } = await this.supabaseAdmin
      .from("mensagens")
      .select("autor, id_externo, reacao")
      .eq("id", mensagemId)
      .eq("atendimento_id", atendimentoId)
      .maybeSingle();
    if (error) return err(new ServicoExternoError("Falha ao consultar a Mensagem."));
    if (!data) return ok(null);
    const linha = mensagemParaReacaoRowSchema.parse(data);
    return ok({ autor: linha.autor, idExterno: linha.id_externo, reacao: linha.reacao });
  }

  async registrarReacao(
    mensagemId: string,
    reacao: string | null,
  ): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin
      .from("mensagens")
      .update({ reacao })
      .eq("id", mensagemId);
    if (error) return err(new ServicoExternoError("Falha ao registrar a reação."));
    return ok(undefined);
  }
}

type ClienteEmbutido = z.infer<typeof atendimentoDoFuncionarioRowSchema>["clientes"];

const soDigitos = (telefone: string) => telefone.replace(/\D/g, "");

// Quem escreve é o Contato cujo número bate com o do Atendimento; o padrão desempata.
function dadosDoContato(cliente: ClienteEmbutido, chave: string): DadosDoContato {
  if (!cliente) return { contatoNome: null, empresa: null, cnpj: null };
  const contato = cliente.cliente_contatos
    .filter((c) => soDigitos(c.telefone) === chave)
    .sort(
      (a, b) => Number(b.padrao) - Number(a.padrao) || a.criado_em.localeCompare(b.criado_em),
    )[0];
  return { contatoNome: contato?.nome ?? null, empresa: cliente.empresa, cnpj: cliente.cnpj };
}

type LinhaAssumida = {
  id: string;
  telefone: string;
  chave: string;
  funcionario_nome: string | null;
} | null;

function assumido(linha: LinhaAssumida): AtendimentoAssumido | null {
  return linha
    ? {
        id: linha.id,
        telefone: linha.telefone,
        chave: linha.chave,
        funcionarioNome: linha.funcionario_nome,
      }
    : null;
}
