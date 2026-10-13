"use client";

import { AuditoriaFeedFiltro } from "@/presentation/components/organisms/auditoria-feed-filtro.component";
import { ResultadoDoFeed } from "@/presentation/components/organisms/resultado-do-feed.component";
import type { RegistroAcaoDto } from "@/modules/auditoria/application/dtos/registro-acao.dto";
import { useFeed } from "@/modules/auditoria/presentation/view-models/feed/use-feed.hook";

export function FeedContainer({ initialData }: { initialData: RegistroAcaoDto[] }) {
  const { register, errors, aoSubmeter, aoLimpar, registros, carregando, erro } =
    useFeed(initialData);

  return (
    <>
      <AuditoriaFeedFiltro
        register={register}
        errors={errors}
        onSubmit={aoSubmeter}
        onLimpar={aoLimpar}
      />
      <ResultadoDoFeed registros={registros} carregando={carregando} erro={erro} />
    </>
  );
}
