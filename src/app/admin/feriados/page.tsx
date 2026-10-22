import { redirect } from "next/navigation";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { FeriadosPage } from "@/presentation/components/pages/feriados.page";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import { carregarSessao } from "@/presentation/view-models/shell/shell.server";
import { FeriadosContainer } from "@/modules/atendimento/presentation/view-models/feriados/feriados.container";
import { carregarFeriados } from "@/modules/atendimento/presentation/view-models/feriados/feriados.server";
import { SinoAvisosContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/sino-avisos.container";

export default async function Page() {
  const sessao = await carregarSessao();
  if (!sessao) redirect("/login");
  if (sessao.precisaTrocarSenha) redirect("/trocar-senha");
  const feriados = await carregarFeriados();
  // Só quem não é Admin sai da tela; falha de leitura aparece em vez de mandar o Admin para a home.
  if (!feriados.ok && feriados.error.code === "FORBIDDEN") redirect("/");

  return (
    <FeriadosPage
      header={
        <ShellHeader
          nome={sessao.nome}
          papel={sessao.papel}
          setor={sessao.setor}
          sair={<LogoutButtonContainer />}
          avisos={<SinoAvisosContainer usuarioId={sessao.id} />}
        />
      }
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
