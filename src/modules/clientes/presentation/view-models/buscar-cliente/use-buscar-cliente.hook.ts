import { useEffect, useState } from "react";

import type { CadastroOperacionalClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { carregarCadastroOperacionalAction } from "@/modules/clientes/presentation/view-models/buscar-cliente/buscar-cliente.actions";
import { useBuscarClientes } from "@/modules/clientes/presentation/view-models/buscar-cliente/buscar-cliente.queries";
import { podeAtribuirResponsavel, podeEditarCadastroOperacional } from "@/shared/kernel/papeis";

const DEBOUNCE_MS = 300;

export function useBuscarCliente(papel: string, setor: string, apenasSnMei: boolean) {
  const [termo, setTermo] = useState("");
  const [termoDebounced, setTermoDebounced] = useState("");
  const [clienteSelecionado, setClienteSelecionado] =
    useState<CadastroOperacionalClienteDto | null>(null);

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
