import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { marcarAvisoVistoAction } from "@/modules/clientes/presentation/view-models/avisos-cadastro/avisos-cadastro.actions";
import {
  avisoCadastroParaView,
  type AvisoCadastroView,
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
  useEffect(() => {
    void recontar({ cancelRefetch: false });
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
    // Só o clique no aviso marca como visto e leva ao Cliente. A navegação não espera a marcação:
    // se ela falhar, o aviso segue não visto e a próxima leitura o mostra de novo.
    aoSelecionar: async (aviso: AvisoCadastroView) => {
      router.push(aviso.href);
      if (aviso.visto) return;
      await marcarAvisoVistoAction(aviso.id);
      await queryClient.invalidateQueries({ queryKey: avisosCadastroKeys.todos() });
    },
  };
}
