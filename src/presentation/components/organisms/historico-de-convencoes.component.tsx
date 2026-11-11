import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

export type ConvencaoDoHistorico = {
  id: string;
  sindicato: string;
  vigencia: string;
  arquivoNome: string;
  enviadaEm: string;
  href: string;
  selecionada: boolean;
};

type Props = { itens: ConvencaoDoHistorico[]; podeEnviar: boolean };

// As convenções do Cliente, a de vigência mais recente primeiro; as anteriores seguem guardadas. Cada uma abre
// as suas regras aplicadas (a que está em tela leva `aria-current`).
export function HistoricoDeConvencoes({ itens, podeEnviar }: Props) {
  return (
    <Pilha como="section" espaco={3} aria-label="Histórico de convenções">
      <Texto como="h2" variante="subtitulo">
        Convenções do cliente
      </Texto>
      {itens.length === 0 ? (
        <Texto variante="apoio">
          Nenhuma convenção enviada para este cliente.
          {podeEnviar ? " Envie a primeira abaixo." : " O Líder do RH ou o Admin envia o PDF."}
        </Texto>
      ) : (
        <Pilha como="ul" espaco={2}>
          {itens.map((c) => (
            <Caixa como="li" key={c.id}>
              <Linha alinhar="centro" espaco={3} quebra>
                <LinkDeAcao
                  href={c.href}
                  variant={c.selecionada ? "default" : "outline"}
                  atual={c.selecionada}
                >
                  {c.sindicato} · {c.vigencia}
                </LinkDeAcao>
                <Texto variante="nota">
                  {c.arquivoNome} · enviada em {c.enviadaEm}
                </Texto>
              </Linha>
            </Caixa>
          ))}
        </Pilha>
      )}
    </Pilha>
  );
}
