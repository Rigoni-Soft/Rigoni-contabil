import "server-only";

import { makeListarFila } from "@/main/atendimento.factory";
import { ehSetor, type SetorSlug } from "@/shared/kernel/setores";

// Sem tipo de retorno explícito (mesmo padrão de conversa.server.ts): o shape flui por inferência.
export async function carregarFila(setor: SetorSlug) {
  const listarFila = await makeListarFila();
  return listarFila.execute({ setor });
}

// Fila da barra lateral da conversa: a do próprio Setor do usuário. O Admin não tem Setor e vê a
// Fila de qualquer Setor em /fila. Sem Fila (ou sem permissão), a conversa segue sem a barra.
export async function carregarFilaDoProprioSetor(usuario: { papel: string; setor: string }) {
  if (usuario.papel === "admin" || !ehSetor(usuario.setor)) return null;
  const fila = await carregarFila(usuario.setor);
  return fila.ok ? { setor: usuario.setor, dados: fila.value } : null;
}
