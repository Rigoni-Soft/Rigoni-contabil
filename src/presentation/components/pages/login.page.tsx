import { EntradaTemplate } from "@/presentation/components/templates/entrada-template.component";

type LoginPageProps = { formulario: React.ReactNode };

export function LoginPage({ formulario }: LoginPageProps) {
  return (
    <EntradaTemplate
      titulo="Rigoni Contábil"
      subtitulo="Entrar no sistema interno"
      rodape="Acesso restrito — uso interno Rigoni Contábil."
      formulario={formulario}
    />
  );
}
