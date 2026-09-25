"use client";

import { AuditoriaFeedFiltro } from "@/presentation/components/organisms/auditoria-feed-filtro.component";
import { AuditoriaFeed } from "@/presentation/components/organisms/auditoria-feed.component";
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
      {erro && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {erro}
        </p>
      )}
      <div aria-busy={carregando} className={carregando ? "opacity-60" : undefined}>
        <AuditoriaFeed registros={registros} />
      </div>
    </>
  );
}
