import { CabecalhoDeTela } from "@/presentation/components/molecules/cabecalho-de-tela.component";
import { PerfilDaConta } from "@/presentation/components/organisms/perfil-da-conta.component";
import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type PerfilPageProps = {
  header: React.ReactNode;
  formulario: React.ReactNode;
  nome: string;
  email: string;
  papel: string;
  setor: string;
};

export function PerfilPage({ header, formulario, nome, email, papel, setor }: PerfilPageProps) {
  return (
    <TelaDeTrabalhoTemplate
      header={header}
      largura="conta"
      cabecalho={<CabecalhoDeTela titulo="Meu perfil" />}
      conteudo={
        <PerfilDaConta
          nome={nome}
          email={email}
          papel={papel}
          setor={setor}
          formulario={formulario}
        />
      }
    />
  );
}
