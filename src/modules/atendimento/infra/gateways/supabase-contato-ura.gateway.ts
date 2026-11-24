import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CadastroContatoUraInput,
  ClienteParaConfirmar,
  ResultadoCadastroContatoUra,
} from "@/modules/atendimento/application/ports/in/cadastrar-contato-ura.provider";
import type { ContatoUraPort } from "@/modules/atendimento/application/ports/out/contato-ura.provider";
import {
  cadastroContatoUraRpcSchema,
  clienteParaConfirmarRowSchema,
} from "@/modules/atendimento/infra/dtos/cadastro-contato-ura-rpc.dto";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export class SupabaseContatoUraGateway implements ContatoUraPort {
  constructor(
    private readonly supabaseUsuario: SupabaseClient,
    private readonly supabaseAdmin: SupabaseClient,
  ) {}

  async clientePorCnpj(cnpj: string): Promise<Result<ClienteParaConfirmar | null, AppError>> {
    const { data, error } = await this.supabaseAdmin
      .from("clientes")
      .select("id, empresa, cnpj")
      .eq("cnpj", cnpj)
      .maybeSingle();
    if (error) return err(new ServicoExternoError("Falha ao consultar o Cliente."));
    if (!data) return ok(null);
    const linha = clienteParaConfirmarRowSchema.safeParse(data);
    if (!linha.success) return err(new ServicoExternoError("Cliente em formato inválido."));
    return ok(linha.data);
  }

  async cadastrar(
    input: CadastroContatoUraInput,
  ): Promise<Result<ResultadoCadastroContatoUra, AppError>> {
    const { data, error } = await this.supabaseUsuario.rpc("cadastrar_contato_ura", {
      p_atendimento_id: input.atendimentoId,
      p_cliente_id: input.clienteId,
      p_nome: input.nome,
      p_email: input.email,
    });
    if (error) {
      if (error.code === "42501") return err(new ForbiddenError(error.message));
      if (error.code === "22023" || error.code === "23514" || error.code === "23505") {
        return err(new ValidationError(error.message));
      }
      return err(new ServicoExternoError("Falha ao cadastrar o contato."));
    }
    const linha = cadastroContatoUraRpcSchema.safeParse(data);
    if (!linha.success) return err(new ServicoExternoError("Resposta do cadastro inválida."));
    if (linha.data.status === "em_outro_cliente") return ok({ status: "em_outro_cliente" });
    return ok({
      status: linha.data.status,
      contatoId: linha.data.contato_id,
      nome: linha.data.nome,
    });
  }
}
