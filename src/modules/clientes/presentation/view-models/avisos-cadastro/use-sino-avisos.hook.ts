import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { marcarAvisoVistoAction } from "@/modules/clientes/presentation/view-models/avisos-cadastro/avisos-cadastro.actions";
import {
  avisoCadastroParaView,
  type AvisoDeCadastro,
} from "@/modules/clientes/presentation/view-models/avisos-cadastro/avisos-cadastro.presenter";
import {
  avisosCadastroKeys,
  useContadorAvisosQuery,
  useListaAvisosQuery,
} from "@/modules/clientes/presentation/view-models/avisos-cadastro/avisos-cadastro.queries";

export function useSinoAvisos() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [abriu, setAbriu] = useState(false);
  const contador = useContadorAvisosQuery();
  const lista = useListaAvisosQuery(abriu);
  const { refetch: recontar } = contador;

  // A cada navegação o contador relê, sem esperar os 30 s do polling.
  // A leitura do mount já é da própria query: só as navegações seguintes relêem.
  const primeiraRota = useRef(true);
  useEffect(() => {
    if (primeiraRota.current) {
      primeiraRota.current = false;
      return;
    }
    void recontar();
  }, [pathname, recontar]);

  const avisos = (lista.data?.pages ?? []).flatMap((pagina) => pagina.itens);

  return {
    // Falha de leitura (ex.: sessão expirada) mantém o último contador conhecido.
    contador: contador.data ?? 0,
    avisos: avisos.map(avisoCadastroParaView),
    estado: lista.isError
      ? ("erro" as const)
      : lista.isPending
        ? ("carregando" as const)
        : ("pronto" as const),
    temMais: lista.hasNextPage,
    carregandoMais: lista.isFetchingNextPage,
    // Abrir não marca nada: só carrega a lista (e relê, se já tinha aberto antes).
    aoAbrir: () => {
      if (abriu) void lista.refetch();
      setAbriu(true);
    },
    aoCarregarMais: () => void lista.fetchNextPage(),
    aoTentarDeNovo: () => void lista.refetch(),
    // Só o clique no aviso marca como visto e leva ao Cliente. Marca antes de navegar; se a
    // marcação falhar, navega mesmo assim e o aviso segue não visto na próxima leitura.
    aoSelecionar: async (aviso: AvisoDeCadastro) => {
      if (!aviso.visto) await marcarAvisoVistoAction(aviso.id);
      router.push(aviso.href);
      await queryClient.invalidateQueries({ queryKey: avisosCadastroKeys.todos() });
    },
  };
}
