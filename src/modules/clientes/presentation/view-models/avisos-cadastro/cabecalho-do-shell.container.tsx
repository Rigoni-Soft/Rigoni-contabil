import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import { SinoAvisosContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/sino-avisos.container";

// Cabeçalho comum das telas autenticadas. Mora aqui (e não em presentation global) porque o sino de
// Avisos é do módulo clientes, e a presentation global não importa módulos.
export function CabecalhoDoShellContainer({
  sessao,
}: {
  sessao: { id: string; nome: string; papel: string; setor: string };
}) {
  return (
    <ShellHeader
      nome={sessao.nome}
      papel={sessao.papel}
      setor={sessao.setor}
      sair={<LogoutButtonContainer />}
      avisos={<SinoAvisosContainer usuarioId={sessao.id} />}
    />
  );
}
