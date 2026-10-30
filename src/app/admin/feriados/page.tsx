import { redirect } from "next/navigation";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { FeriadosPage } from "@/presentation/components/pages/feriados.page";
import { exigirSessao } from "@/presentation/view-models/shell/shell.server";
import { FeriadosContainer } from "@/modules/atendimento/presentation/view-models/feriados/feriados.container";
import { carregarFeriados } from "@/modules/atendimento/presentation/view-models/feriados/feriados.server";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";

export default async function Page() {
  const sessao = await exigirSessao();
  const feriados = await carregarFeriados();
  // Só quem não é Admin sai da tela; falha de leitura aparece em vez de mandar o Admin para a home.
  if (!feriados.ok && feriados.error.code === "FORBIDDEN") redirect("/");

  return (
    <FeriadosPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      conteudo={
        feriados.ok ? (
          <FeriadosContainer feriados={feriados.value} />
        ) : (
          <AvisoDeStatus tipo="erro" texto={feriados.error.message} />
        )
      }
    />
  );
}
