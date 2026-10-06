import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AtendimentoRepositoryPort,
  FuncionarioDoSetor,
  NovoAtendimento,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

type LinhaFuncionario = { id: string; atendimentos_no_mes: number | string; livre: boolean };

// Usa o client service_role (docs/adr/0001); a tabela não tem policy para usuário logado.
export class SupabaseAtendimentoGateway implements AtendimentoRepositoryPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async funcionariosDoSetor(setor: string): Promise<Result<FuncionarioDoSetor[], AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("funcionarios_do_setor", {
      p_setor: setor,
    });
    if (error) return err(new ServicoExternoError("Falha ao consultar os Funcionários do Setor."));
    return ok(
      (data as LinhaFuncionario[]).map((l) => ({
        id: l.id,
        atendimentosNoMes: Number(l.atendimentos_no_mes),
        livre: l.livre,
      })),
    );
  }

  async abrir(a: NovoAtendimento): Promise<Result<{ id: string }, AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("abrir_atendimento", {
      p_telefone: a.telefone,
      p_cliente_id: a.clienteId,
      p_setor: a.setor,
      p_funcionario_id: a.funcionarioId,
      p_mensagens: a.mensagens,
    });
    if (error) return err(new ServicoExternoError("Falha ao abrir o Atendimento."));
    return ok({ id: data as string });
  }
}
