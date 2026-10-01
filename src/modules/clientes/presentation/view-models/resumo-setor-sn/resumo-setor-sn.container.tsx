"use client";

import { ResumoSetorSn } from "@/presentation/components/organisms/resumo-setor-sn.component";
import { Button } from "@/presentation/components/ui/button";
import type { ResumoSetorSnDto } from "@/modules/clientes/application/ports/in/obter-resumo-setor-sn.provider";
import { EditarCadastroOperacionalContainer } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.container";

import { useResumoSetorSn } from "./use-resumo-setor-sn.hook";

type Props = { initialData: ResumoSetorSnDto; papel: string; setor: string };

export function ResumoSetorSnContainer({ initialData, papel, setor }: Props) {
  const {
    cards,
    totalClientes,
    bucketAberto,
    abrirBucket,
    clienteSelecionado,
    selecionarCliente,
    fecharPainel,
    erro,
    readOnly,
  } = useResumoSetorSn(initialData, papel, setor);

  if (clienteSelecionado) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-foreground">
            {readOnly ? "Visualizar cadastro operacional" : "Editar cadastro operacional"}
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={fecharPainel}>
            Voltar ao resumo
          </Button>
        </div>
        <EditarCadastroOperacionalContainer
          dados={clienteSelecionado}
          readOnly={readOnly}
          onCancelar={fecharPainel}
        />
      </section>
    );
  }

  return (
    <>
      {erro && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {erro}
        </p>
      )}
      <ResumoSetorSn
        cards={cards}
        totalClientes={totalClientes}
        bucketAberto={bucketAberto}
        onAbrirBucket={abrirBucket}
        onSelecionarCliente={selecionarCliente}
      />
    </>
  );
}
