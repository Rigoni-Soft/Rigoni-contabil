import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { makeRegistrarAcao } from "@/main/auditoria.factory";
import { createSupabaseServer } from "@/main/supabase-server.factory";
import type { CriarClientePort } from "@/modules/clientes/application/ports/in/criar-cliente.provider";
import type { EditarCadastroOperacionalClientePort } from "@/modules/clientes/application/ports/in/editar-cadastro-operacional-cliente.provider";
import type { AuditoriaPort } from "@/modules/clientes/application/ports/out/auditoria.provider";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/clientes/application/ports/out/sessao.provider";
import { BuscarClientes } from "@/modules/clientes/application/use-cases/buscar-clientes.use-case";
import { ConsultarCadastroOperacionalCliente } from "@/modules/clientes/application/use-cases/consultar-cadastro-operacional-cliente.use-case";
import { CriarCliente } from "@/modules/clientes/application/use-cases/criar-cliente.use-case";
import { EditarCadastroOperacionalCliente } from "@/modules/clientes/application/use-cases/editar-cadastro-operacional-cliente.use-case";
import { ObterResumoSetorSn } from "@/modules/clientes/application/use-cases/obter-resumo-setor-sn.use-case";
import { SupabaseClienteQueryGateway } from "@/modules/clientes/infra/gateways/cliente-query.gateway";
import { SupabaseArquivoStorageGateway } from "@/modules/clientes/infra/gateways/supabase-arquivo-storage.gateway";
import { SupabaseClienteRepository } from "@/modules/clientes/infra/repositories/cliente.repository";
import { ObterSessao } from "@/modules/usuarios/application/use-cases/obter-sessao.use-case";
import { SupabaseSessaoGateway } from "@/modules/usuarios/infra/gateways/supabase-sessao.gateway";
import { SupabaseUsuarioRepository } from "@/modules/usuarios/infra/repositories/usuario.repository";

// Adapta a sessão do módulo usuarios à porta própria de clientes (arquitetura.md,
// seção 3.11) — monta o ObterSessao direto (não chama usuarios.factory) pra não
// criar import circular entre as duas factories, mesmo motivo do auditoria.factory.
function sessaoViaUsuarios(supabase: SupabaseClient): SessaoPort {
  const obterSessao = new ObterSessao(
    new SupabaseSessaoGateway(supabase),
    new SupabaseUsuarioRepository(supabase),
  );
  return {
    usuarioAtual: async (): Promise<AtorSessaoDto | null> => {
      const usuario = await obterSessao.execute();
      return usuario ? { id: usuario.id, papel: usuario.papel, setor: usuario.setor } : null;
    },
  };
}

// Best-effort: falha ao auditar não derruba o cadastro (mesmo contrato do usuarios.factory).
function auditoriaViaModuloAuditoria(): AuditoriaPort {
  return {
    registrar: async (input) => {
      const registrarAcao = await makeRegistrarAcao();
      const resultado = await registrarAcao.execute(input);
      if (!resultado.ok) console.error("Falha ao registrar auditoria:", resultado.error.message);
    },
  };
}

export async function makeCriarCliente(): Promise<CriarClientePort> {
  const supabase = await createSupabaseServer();
  return new CriarCliente(
    sessaoViaUsuarios(supabase),
    new SupabaseClienteRepository(supabase),
    new SupabaseArquivoStorageGateway(supabase),
    auditoriaViaModuloAuditoria(),
  );
}

export async function makeEditarCadastroOperacionalCliente(): Promise<EditarCadastroOperacionalClientePort> {
  const supabase = await createSupabaseServer();
  return new EditarCadastroOperacionalCliente(
    sessaoViaUsuarios(supabase),
    new SupabaseClienteRepository(supabase),
    auditoriaViaModuloAuditoria(),
  );
}

export async function makeConsultarCadastroOperacionalCliente(): Promise<ConsultarCadastroOperacionalCliente> {
  const supabase = await createSupabaseServer();
  return new ConsultarCadastroOperacionalCliente(
    sessaoViaUsuarios(supabase),
    new SupabaseClienteQueryGateway(supabase),
  );
}

export async function makeBuscarClientes(): Promise<BuscarClientes> {
  const supabase = await createSupabaseServer();
  return new BuscarClientes(new SupabaseClienteQueryGateway(supabase));
}

export async function makeObterResumoSetorSn(): Promise<ObterResumoSetorSn> {
  const supabase = await createSupabaseServer();
  return new ObterResumoSetorSn(new SupabaseClienteQueryGateway(supabase));
}
