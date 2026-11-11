import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import {
  LinhaDoCartaoDePonto,
  type LinhaDoCartao,
} from "@/presentation/components/molecules/linha-do-cartao-de-ponto.component";
import { NavegacaoDeMes } from "@/presentation/components/molecules/navegacao-de-mes.component";
import {
  TotalizacaoDoPonto,
  type ItemDaTotalizacao,
} from "@/presentation/components/molecules/totalizacao-do-ponto.component";

type Props = {
  empregado: string;
  rotuloMes: string;
  mesAnteriorHref: string;
  proximoMesHref?: string;
  quinzenas: { rotulo: string; href: string; atual: boolean }[];
  linhas: LinhaDoCartao[];
  totalizacao: ItemDaTotalizacao[];
  editavel: boolean;
  pendente: boolean;
  erro?: string;
  onSalvarDia: (data: string, campos: FormData) => void;
};

// O Cartão de ponto de um empregado numa quinzena, com a Totalização logo abaixo (a que vai para o PDF).
export function CartaoDePonto({
  empregado,
  rotuloMes,
  mesAnteriorHref,
  proximoMesHref,
  quinzenas,
  linhas,
  totalizacao,
  editavel,
  pendente,
  erro,
  onSalvarDia,
}: Props) {
  return (
    <Pilha como="section" espaco={6} aria-label={`Cartão de ponto de ${empregado}`}>
      <Texto como="h2" variante="subtitulo">
        Cartão de ponto de {empregado}
      </Texto>
      <NavegacaoDeMes
        rotuloMes={rotuloMes}
        anteriorHref={mesAnteriorHref}
        proximoHref={proximoMesHref}
        destaque
      />
      <Linha como="nav" aria-label="Quinzena" espaco={2}>
        {quinzenas.map((q) => (
          <LinkDeAcao key={q.rotulo} href={q.href} variant={q.atual ? "default" : "outline"}>
            {q.rotulo}
          </LinkDeAcao>
        ))}
      </Linha>
      {!editavel && (
        <Texto variante="apoio">
          Só o Responsável do RH do cliente digita o cartão; aqui ele fica em leitura.
        </Texto>
      )}
      {erro && <AvisoDeStatus tipo="erro" legivel texto={erro} />}
      <Pilha espaco={3}>
        {linhas.map((linha) => (
          <LinhaDoCartaoDePonto
            key={`${linha.data}|${linha.entrada1}|${linha.saida1}|${linha.entrada2}|${linha.saida2}|${linha.extraEntrada}|${linha.extraSaida}|${linha.abono}`}
            linha={linha}
            editavel={editavel}
            pendente={pendente}
            onSalvar={onSalvarDia}
          />
        ))}
      </Pilha>
      <TotalizacaoDoPonto titulo="Totalização da quinzena" itens={totalizacao} />
    </Pilha>
  );
}
