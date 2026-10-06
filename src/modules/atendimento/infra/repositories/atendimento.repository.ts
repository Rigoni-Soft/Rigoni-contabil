import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { NovaMensagem } from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type { AnexarMensagemOutput } from "@/modules/atendimento/application/ports/in/anexar-mensagem-atendimento.provider";
import type {
  AtendimentoAssumido,
  AtendimentoEmAndamento,
  AtendimentoRepositoryPort,
  FuncionarioDoSetor,
  ItemDaFila,
  NovaTransferencia,
  NovoAtendimento,
  ResultadoAbertura,
  ResultadoEncerramento,
  ResultadoTransferencia,
  RoteamentoDoCliente,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import {
  aberturaRowSchema,
  anexoRowSchema,
  atendimentoEmAndamentoRowSchema,
  encerramentoRowSchema,
  filaRowSchema,
  liderRowSchema,
  posicaoRowSchema,
  roteamentoDoClienteRowSchema,
  transferenciaRowSchema,
} from "@/modules/atendimento/infra/dtos/atendimento-rpc-row.dto";
import { funcionarioDoSetorRowSchema } from "@/modules/atendimento/infra/dtos/funcionario-do-setor-row.dto";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

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
    });
    if (error) return err(new ServicoExternoError("Falha ao abrir o Atendimento."));
    const id = aberturaRowSchema.parse(data);
    return ok(id ? { status: "aberto", id } : { status: "conflito" });
  }

  async anexarMensagem(
    chave: string,
    mensagem: NovaMensagem,
  ): Promise<Result<AnexarMensagemOutput, AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("anexar_mensagem_atendimento", {
      p_chave: chave,
      p_autor: mensagem.autor,
      p_texto: mensagem.texto,
    });
    if (error) return err(new ServicoExternoError("Falha ao registrar a Mensagem."));
    return ok({ anexada: anexoRowSchema.parse(data) });
  }

  async buscarEmAndamento(id: string): Promise<Result<AtendimentoEmAndamento | null, AppError>> {
    const { data, error } = await this.supabaseAdmin
      .from("atendimentos")
      .select("id, cliente_id, setor, funcionario_id, telefone, chave_telefone")
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
    return ok({
      regime: linha.regime,
      responsavelId: linha.cliente_cadastro_operacional_sn?.responsavel_id ?? null,
    });
  }

  // Cada Setor tem um só Líder (regra de domínio); se o banco devolver dois, falha em vez de escolher.
  async liderDoSetor(setor: SetorSlug): Promise<Result<string | null, AppError>> {
    const { data, error } = await this.supabaseAdmin
      .from("perfis")
      .select("id")
      .eq("setor", setor)
      .eq("papel", "lider_setor")
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
    });
    if (error) return err(new ServicoExternoError("Falha ao transferir o Atendimento."));
    const linha = transferenciaRowSchema.parse(data);
    if (linha.status !== "transferido") return ok(linha);
    return ok({
      status: "transferido",
      naFila: linha.na_fila,
      proximoDaOrigem: assumido(linha.proximo_da_origem),
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

  async encerrar(
    atendimentoId: string,
    funcionarioId: string | null,
    ator: { id: string; setor: SetorSlug },
  ): Promise<Result<ResultadoEncerramento, AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("encerrar_atendimento", {
      p_atendimento_id: atendimentoId,
      p_funcionario_id: funcionarioId,
      p_ator: ator.id,
      p_ator_setor: ator.setor,
    });
    if (error) return err(new ServicoExternoError("Falha ao encerrar o Atendimento."));
    const linha = encerramentoRowSchema.parse(data);
    if (linha.status === "inexistente") return ok(linha);
    return ok({ status: "encerrado", proximo: assumido(linha.proximo) });
  }
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
