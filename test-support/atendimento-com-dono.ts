import type { SupabaseClient } from "@supabase/supabase-js";

import type { AberturaAtendimento } from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";

// A assunção ainda não tem caso de uso (vem com a aba Atendimento): as suítes de integração que
// precisam de um Atendimento com Funcionário abrem na espera e põem o dono direto na tabela, como
// o evento de assunção grava.
export async function abrirComDono(
  admin: SupabaseClient,
  repositorio: AtendimentoRepositoryPort,
  abertura: AberturaAtendimento,
  funcionarioId: string,
): Promise<string> {
  const aberto = await repositorio.abrir(abertura);
  if (!aberto.ok) throw new Error("abertura falhou");
  await atribuir(admin, aberto.value.id, funcionarioId);
  return aberto.value.id;
}

export async function atribuir(
  admin: SupabaseClient,
  atendimentoId: string,
  funcionarioId: string,
): Promise<void> {
  const atribuido = await admin
    .from("atendimentos")
    .update({
      funcionario_id: funcionarioId,
      assumido_em: new Date().toISOString(),
      fila_desde: null,
    })
    .eq("id", atendimentoId);
  if (atribuido.error) throw new Error(atribuido.error.message);
  const evento = await admin
    .from("assuncoes_atendimento")
    .insert({ atendimento_id: atendimentoId, funcionario_id: funcionarioId });
  if (evento.error) throw new Error(evento.error.message);
}
