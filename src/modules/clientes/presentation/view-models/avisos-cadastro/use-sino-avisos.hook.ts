import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { marcarAvisoVistoAction } from "@/modules/clientes/presentation/view-models/avisos-cadastro/avisos-cadastro.actions";
import {
  anuncioDeAvisos,
  avisoCadastroParaView,
  type AvisoDeCadastro,
} from "@/modules/clientes/presentation/view-models/avisos-cadastro/avisos-cadastro.presenter";
import {
  avisosCadastroKeys,
  useContadorAvisosQuery,
  useListaAvisosQuery,
} from "@/modules/clientes/presentation/view-models/avisos-cadastro/avisos-cadastro.queries";

function modalDo(painelId: string) {
  return document.getElementById(painelId) as HTMLDialogElement | null;
}

export function useSinoAvisos(painelId: string, usuarioId: string) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [abriu, setAbriu] = useState(false);
  const [anuncio, setAnuncio] = useState("");
  const contadorAnterior = useRef<number | null>(null);
  const contador = useContadorAvisosQuery(usuarioId);
  const lista = useListaAvisosQuery(usuarioId, abriu);
  const { refetch: recontar } = contador;

  useEffect(() => {
    void recontar({ cancelRefetch: false });
  }, [pathname, recontar]);

  const naoVistos = contador.data;
  useEffect(() => {
    if (naoVistos === undefined) return;
    const antes = contadorAnterior.current;
    contadorAnterior.current = naoVistos;
    if (antes === null) return;
    setAnuncio(naoVistos > antes ? anuncioDeAvisos(naoVistos) : "");
  }, [naoVistos]);

  return {
    contador: contador.data ?? 0,
    anuncio,
    avisos: (lista.data?.pages ?? []).flatMap((pagina) => pagina.itens.map(avisoCadastroParaView)),
    estado: lista.isError
      ? ("erro" as const)
      : lista.isPending
        ? ("carregando" as const)
        : ("pronto" as const),
    temMais: lista.hasNextPage,
    carregandoMais: lista.isFetchingNextPage,
    aoAbrir: () => {
      if (abriu) void lista.refetch();
      setAbriu(true);
      const modal = modalDo(painelId);
      if (modal && !modal.open) modal.showModal();
    },
    aoFechar: () => modalDo(painelId)?.close(),
    aoCarregarMais: () => void lista.fetchNextPage(),
    aoTentarDeNovo: () => void lista.refetch(),
    aoSelecionar: async (aviso: AvisoDeCadastro) => {
      modalDo(painelId)?.close();
      if (!aviso.visto) {
        try {
          await marcarAvisoVistoAction(aviso.id);
        } catch {}
      }
      router.push(aviso.href);
      await queryClient.invalidateQueries({ queryKey: avisosCadastroKeys.todos(usuarioId) });
    },
  };
}
