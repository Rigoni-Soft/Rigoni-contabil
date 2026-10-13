import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type TrocarSenhaPageProps = { header: React.ReactNode; formulario: React.ReactNode };

export function TrocarSenhaPage({ header, formulario }: TrocarSenhaPageProps) {
  return (
    <TelaDeTrabalhoTemplate
      header={header}
      largura="conta"
      titulo="Trocar senha"
      descricao="Você está usando uma senha provisória. Defina uma nova senha para continuar."
      conteudo={formulario}
    />
  );
}
