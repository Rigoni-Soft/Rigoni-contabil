import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { NovaMensagem } from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type {
  AtendimentoRepositoryPort,
  FuncionarioDoSetor,
  NovoAtendimento,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
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
        .map((l) => ({
          id: l.id,
          atendimentosNoMes: Number(l.atendimentos_no_mes),
          livre: l.livre,
        })),
    );
  }

  async abrir(atendimento: NovoAtendimento): Promise<Result<{ id: string } | null, AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("abrir_atendimento", {
      p_telefone: atendimento.telefone,
      p_chave: atendimento.chave,
      p_cliente_id: atendimento.clienteId,
      p_setor: atendimento.setor,
      p_funcionario_id: atendimento.funcionarioId,
      p_mensagens: atendimento.mensagens,
    });
    if (error) return err(new ServicoExternoError("Falha ao abrir o Atendimento."));
    return ok(data ? { id: z.string().parse(data) } : null);
  }

  async anexarMensagem(chave: string, mensagem: NovaMensagem): Promise<Result<boolean, AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("anexar_mensagem_atendimento", {
      p_chave: chave,
      p_autor: mensagem.autor,
      p_texto: mensagem.texto,
    });
    if (error) return err(new ServicoExternoError("Falha ao registrar a Mensagem."));
    return ok(data === true);
  }
}
