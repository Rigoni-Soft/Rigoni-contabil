import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { RegistroAcaoDto } from "@/modules/auditoria/application/dtos/registro-acao.dto";
import { registroAcaoParaView } from "@/modules/auditoria/presentation/view-models/feed/feed.presenter";
import { useFeedAuditoria } from "@/modules/auditoria/presentation/view-models/feed/feed.queries";
import {
  filtroFeedSchema,
  type FiltroFeedValues,
} from "@/modules/auditoria/presentation/view-models/feed/feed.schema";

const FILTRO_VAZIO: FiltroFeedValues = {
  setor: "",
  ator: "",
  acao: "",
  alvo: "",
  resultado: "",
  dataInicio: "",
  dataFim: "",
};

function removerCamposVazios(valores: FiltroFeedValues): FiltroFeedValues {
  return Object.fromEntries(
    Object.entries(valores).filter(([, v]) => v !== "" && v !== undefined),
  ) as FiltroFeedValues;
}

export function useFeed(initialData: RegistroAcaoDto[]) {
  const [filtroAplicado, setFiltroAplicado] = useState<FiltroFeedValues>({});

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FiltroFeedValues>({ resolver: zodResolver(filtroFeedSchema) });

  const query = useFeedAuditoria(filtroAplicado, initialData);

  const aoSubmeter = handleSubmit((valores) => {
    setFiltroAplicado(removerCamposVazios(valores));
  });

  const aoLimpar = () => {
    reset(FILTRO_VAZIO);
    setFiltroAplicado({});
  };

  return {
    register,
    errors,
    aoSubmeter,
    aoLimpar,
    registros: (query.data ?? []).map(registroAcaoParaView),
    carregando: query.isFetching,
    erro: query.isError ? (query.error as Error).message : undefined,
  };
}
