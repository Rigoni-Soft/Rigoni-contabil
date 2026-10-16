import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { TelaDeAvisoPage } from "@/presentation/components/pages/tela-de-aviso.page";

export default function NotFound() {
  return (
    <TelaDeAvisoPage
      subtitulo="Página não encontrada"
      aviso="O endereço pode estar errado ou a página foi removida."
      rodape="Acesso restrito — uso interno Rigoni Contábil."
      acoes={
        <LinkDeAcao href="/" variant="default">
          Ir para o início
        </LinkDeAcao>
      }
    />
  );
}
