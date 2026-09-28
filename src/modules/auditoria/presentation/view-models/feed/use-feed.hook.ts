import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { RegistroAcaoDto } from "@/modules/auditoria/application/dtos/registro-acao.dto";
import { useFeedAuditoria } from "@/modules/auditoria/presentation/view-models/feed/feed.queries";
import { registroAcaoParaView } from "@/modules/auditoria/presentation/view-models/feed/feed.presenter";
import {
  filtroFeedSchema,
  type FiltroFeedValues,
} from "@/modules/auditoria/presentation/view-models/feed/feed.schema";

// reset({}) não limpa inputs não controlados sem defaultValues no useForm — precisa
// do valor "" explícito por campo (o vazio real de input/select nativos).
const FILTRO_VAZIO: FiltroFeedValues = {
  setor: "",
  ator: "",
  acao: "",
  alvo: "",
  resultado: "",
  dataInicio: "",
  dataFim: "",
};

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
    // Campos vazios não viram filtro (string vazia != "sem filtro" pro caso de uso).
    const filtro = Object.fromEntries(
      Object.entries(valores).filter(([, v]) => v !== "" && v !== undefined),
    ) as FiltroFeedValues;
    setFiltroAplicado(filtro);
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
