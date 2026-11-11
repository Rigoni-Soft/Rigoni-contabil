import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import {
  LinhaDoCartaoDePonto,
  type AvisoDoDia,
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
  // Quando a Totalização usou a legislação por falta de convenção vigente.
  avisoDaTotalizacao?: string;
  editavel: boolean;
  pendente: boolean;
  // Resultado do último "Salvar", mostrado na linha do dia a que se refere.
  aviso?: AvisoDoDia & { data: string };
  // Troca com o empregado escolhido: os campos de cada dia recomeçam dos valores dele.
  empregadoId: string;
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
  avisoDaTotalizacao,
  editavel,
  pendente,
  aviso,
  empregadoId,
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
          <LinkDeAcao
            key={q.rotulo}
            href={q.href}
            variant={q.atual ? "default" : "outline"}
            atual={q.atual}
          >
            {q.rotulo}
          </LinkDeAcao>
        ))}
      </Linha>
      {!editavel && (
        <Texto variante="apoio">
          Só o Responsável do RH do cliente digita o cartão; aqui ele fica em leitura.
        </Texto>
      )}
      <Pilha espaco={3}>
        {linhas.map((linha) => (
          <LinhaDoCartaoDePonto
            key={`${empregadoId}|${linha.data}`}
            aviso={aviso?.data === linha.data ? aviso : undefined}
            linha={linha}
            editavel={editavel}
            pendente={pendente}
            onSalvar={onSalvarDia}
          />
        ))}
      </Pilha>
      {avisoDaTotalizacao && <Texto variante="apoio">{avisoDaTotalizacao}</Texto>}
      <TotalizacaoDoPonto titulo="Totalização da quinzena" itens={totalizacao} />
    </Pilha>
  );
}
