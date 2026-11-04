import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

type NavegacaoDeMesProps = {
  rotuloMes: string;
  anteriorHref: string;
  // Sem próximo no mês corrente.
  proximoHref?: string;
};

// Mês anterior, mês em tela e próximo: o mês fica no centro mesmo quando falta o próximo.
export function NavegacaoDeMes({ rotuloMes, anteriorHref, proximoHref }: NavegacaoDeMesProps) {
  return (
    <Caixa
      como="nav"
      aria-label="Mês do acompanhamento"
      className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"
    >
      <Caixa>
        <LinkDeAcao href={anteriorHref} variant="ghost">
          Mês anterior
        </LinkDeAcao>
      </Caixa>
      <Texto como="span" variante="subtitulo" aria-current="date" className="capitalize">
        {rotuloMes}
      </Texto>
      <Caixa className="justify-self-end">
        {proximoHref && (
          <LinkDeAcao href={proximoHref} variant="ghost">
            Próximo mês
          </LinkDeAcao>
        )}
      </Caixa>
    </Caixa>
  );
}
