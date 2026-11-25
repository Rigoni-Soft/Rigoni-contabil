import { CabecalhoDeTela } from "@/presentation/components/molecules/cabecalho-de-tela.component";
import { PerfilDaConta } from "@/presentation/components/organisms/perfil-da-conta.component";
import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type PerfilPageProps = {
  header: React.ReactNode;
  voltar: React.ReactNode;
  avatar?: React.ReactNode;
  formulario: React.ReactNode;
  nome: string;
  email: string;
  papel: string;
  setor: string;
};

export function PerfilPage({
  header,
  voltar,
  avatar,
  formulario,
  nome,
  email,
  papel,
  setor,
}: PerfilPageProps) {
  return (
    <TelaDeTrabalhoTemplate
      header={header}
      largura="conta"
      cabecalho={<CabecalhoDeTela titulo="Meu perfil" voltar={voltar} />}
      conteudo={
        <PerfilDaConta
          nome={nome}
          email={email}
          papel={papel}
          setor={setor}
          avatar={avatar}
          formulario={formulario}
        />
      }
    />
  );
}
