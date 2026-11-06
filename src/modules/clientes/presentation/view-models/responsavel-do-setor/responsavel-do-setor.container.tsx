"use client";

import { useState } from "react";

import { ResponsavelDoSetor } from "@/presentation/components/organisms/responsavel-do-setor.component";
import { atribuirResponsavelAction } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/atribuir-responsavel.actions";
import { opcoesResponsavel } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.presenter";
import { useResponsaveisElegiveis } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/responsaveis.queries";

type Props = {
  clienteId: string;
  setorRotulo: string;
  atual: { id: string; nome: string } | null;
};

export function ResponsavelDoSetorContainer({ clienteId, setorRotulo, atual }: Props) {
  const [salvoId, setSalvoId] = useState(atual?.id ?? "");
  const [valor, setValor] = useState(atual?.id ?? "");
  const [listaAberta, setListaAberta] = useState(false);
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string>();
  const [salvo, setSalvo] = useState(false);
  const elegiveis = useResponsaveisElegiveis(listaAberta);

  const salvar = async () => {
    setPendente(true);
    setErro(undefined);
    setSalvo(false);
    try {
      const r = await atribuirResponsavelAction({ clienteId, responsavelId: valor || null });
      if (!r.ok) {
        setErro(r.error.message);
        return;
      }
      setSalvoId(valor);
      setSalvo(true);
    } catch {
      setErro("Não foi possível salvar agora. Verifique a conexão e tente novamente.");
    } finally {
      setPendente(false);
    }
  };

  return (
    <ResponsavelDoSetor
      setor={setorRotulo}
      valor={valor}
      opcoes={opcoesResponsavel(
        { responsavelId: atual?.id ?? null, responsavelNome: atual?.nome ?? null },
        elegiveis.data ?? [],
      )}
      onMudar={(id) => {
        setValor(id);
        setSalvo(false);
      }}
      onAbrir={() => setListaAberta(true)}
      estadoLista={elegiveis.isError ? "erro" : elegiveis.isLoading ? "carregando" : "ok"}
      onTentarNovamente={() => void elegiveis.refetch()}
      onSalvar={() => void salvar()}
      alterado={valor !== salvoId}
      pendente={pendente}
      erro={erro}
      salvo={salvo}
    />
  );
}
