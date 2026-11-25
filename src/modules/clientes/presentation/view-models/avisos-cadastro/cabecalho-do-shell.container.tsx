import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import { SinoAvisosContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/sino-avisos.container";

export function CabecalhoDoShellContainer({
  sessao,
}: {
  sessao: {
    id: string;
    nome: string;
    papel: string;
    setor: string;
    precisaTrocarSenha: boolean;
    avatarAtualizadoEm?: string | null;
  };
}) {
  return (
    <ShellHeader
      nome={sessao.nome}
      papel={sessao.papel}
      setor={sessao.setor}
      comAvatar={!sessao.precisaTrocarSenha}
      avatarAtualizadoEm={sessao.avatarAtualizadoEm}
      sair={<LogoutButtonContainer />}
      avisos={<SinoAvisosContainer usuarioId={sessao.id} />}
    />
  );
}
