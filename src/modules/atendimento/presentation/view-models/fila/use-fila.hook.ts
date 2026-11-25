import { useEffect, useState } from "react";

import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import { itemDaFilaParaView } from "@/modules/atendimento/presentation/view-models/fila/fila.presenter";
import { useFilaQuery } from "@/modules/atendimento/presentation/view-models/fila/fila.queries";
import { ehSetor, type SetorSlug } from "@/shared/kernel/setores";

export function useFila(
  setorInicial: SetorSlug,
  inicial: ItemDaFilaVisto[],
  podeEscolherSetor: boolean,
  usuarioId?: string,
) {
  const [setor, setSetor] = useState<SetorSlug>(setorInicial);
  const [agora, setAgora] = useState(() => Date.now());
  const query = useFilaQuery(
    podeEscolherSetor ? setor : null,
    setor === setorInicial ? inicial : undefined,
  );

  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return {
    setor,
    escolherSetor: (valor: string) => {
      if (ehSetor(valor)) setSetor(valor);
    },
    itens: (query.data ?? []).map((item) =>
      itemDaFilaParaView(item, agora, usuarioId, !podeEscolherSetor),
    ),
    carregando: query.isPending,
    indisponivel: query.isError,
  };
}
