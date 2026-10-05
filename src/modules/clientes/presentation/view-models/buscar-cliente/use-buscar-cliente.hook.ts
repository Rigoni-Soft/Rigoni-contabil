import { useEffect, useState } from "react";

import type { CadastroOperacionalClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { carregarCadastroOperacionalAction } from "@/modules/clientes/presentation/view-models/buscar-cliente/buscar-cliente.actions";
import { useBuscarClientes } from "@/modules/clientes/presentation/view-models/buscar-cliente/buscar-cliente.queries";
import {
  podeAtribuirResponsavel,
  podeEditarCadastroOperacional,
} from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.presenter";

const DEBOUNCE_MS = 300;

export function useBuscarCliente(papel: string, setor: string, apenasSnMei: boolean) {
  const [termo, setTermo] = useState("");
  const [termoDebounced, setTermoDebounced] = useState("");
  const [clienteSelecionado, setClienteSelecionado] =
    useState<CadastroOperacionalClienteDto | null>(null);

  // Debounce simples (stdlib) — evita disparar a query a cada tecla digitada.
  // A busca em si (cache, dedupe, estado de carregando/erro) fica por conta
  // do React Query em buscar-cliente.queries.ts (arquitetura.md, seção 4.9).
  useEffect(() => {
    const timer = setTimeout(() => setTermoDebounced(termo.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [termo]);

  const query = useBuscarClientes(termoDebounced, apenasSnMei);

  const selecionarCliente = async (id: string) => {
    const resultado = await carregarCadastroOperacionalAction(id);
    setClienteSelecionado(resultado.ok ? resultado.data : null);
    setTermo("");
    setTermoDebounced("");
  };

  // Mesma ação por trás de "Nova busca" (topo) e "Cancelar" (dentro do form,
  // #35 corrige: sem isso o <Link href="/"> do form não fazia nada, já que a
  // busca já está em "/") — fecha o painel e volta pro campo de busca.
  const fecharPainel = () => setClienteSelecionado(null);

  return {
    termo,
    setTermo,
    buscando: query.isFetching,
    sugestoesVisiveis: query.data ?? [],
    clienteSelecionado,
    selecionarCliente,
    fecharPainel,
    readOnly: !podeEditarCadastroOperacional(papel, setor),
    podeAtribuirResponsavel: podeAtribuirResponsavel(papel, setor),
  };
}
