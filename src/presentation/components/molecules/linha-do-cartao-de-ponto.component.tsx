import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { CaixaDeMarcacao } from "@/presentation/components/atoms/caixa-de-marcacao.component";
import { Caixa, Grade, Linha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { Button } from "@/presentation/components/ui/button";

// Horários como "HH:MM" (vazio = não batido).
export type LinhaDoCartao = {
  data: string;
  // "seg 16/11".
  rotulo: string;
  entrada1: string;
  saida1: string;
  entrada2: string;
  saida2: string;
  extraEntrada: string;
  extraSaida: string;
  abono: boolean;
  // Feriado ou dia sem jornada: o motivo aparece ao lado do dia.
  nota?: string;
  // As colunas calculadas do dia (H. diária, atrasos, extras por faixa, A.N.), numa linha de texto.
  resumo: string;
};

// Resultado do último "Salvar" deste dia, ao lado dele (não no topo do cartão).
export type AvisoDoDia = { tipo: "erro" | "sucesso"; texto: string };

type Props = {
  linha: LinhaDoCartao;
  // Sem edição (Líder, Admin ou outro Responsável), os campos ficam travados e sem "Salvar".
  editavel: boolean;
  pendente: boolean;
  aviso?: AvisoDoDia;
  onSalvar: (data: string, campos: FormData) => void;
};

const CAMPOS = [
  ["entrada1", "Entrada 1"],
  ["saida1", "Saída 1"],
  ["entrada2", "Entrada 2"],
  ["saida2", "Saída 2"],
  ["extraEntrada", "Extra entrada"],
  ["extraSaida", "Extra saída"],
] as const;

// Um dia do Cartão de ponto: batidas digitadas, coluna Extra e Abono, salvos por dia.
// ponytail: dois pares de batida + Extra na tela (o banco guarda até quatro); mais pares quando um cartão pedir.
export function LinhaDoCartaoDePonto({ linha, editavel, pendente, aviso, onSalvar }: Props) {
  const idDoAviso = `aviso-${linha.data}`;
  return (
    <Caixa
      como="form"
      aria-label={`Dia ${linha.rotulo}`}
      onSubmit={(e) => {
        e.preventDefault();
        onSalvar(linha.data, new FormData(e.currentTarget));
      }}
    >
      <Grade colunas="2>3" espaco={4} className="border-t border-border pt-4">
        <Texto como="span" variante="destaque" className="col-span-2 sm:col-span-3">
          {linha.rotulo}
          {linha.nota && (
            <Texto como="span" variante="nota" className="block">
              {linha.nota}
            </Texto>
          )}
        </Texto>
        {CAMPOS.map(([nome, rotulo]) => (
          <CampoDeTexto
            key={nome}
            id={`${linha.data}-${nome}`}
            rotulo={rotulo}
            type="time"
            name={nome}
            defaultValue={linha[nome]}
            // readOnly: em leitura o horário segue legível e focável (disabled o esmaece e tira da tabulação).
            readOnly={!editavel}
            aria-label={`${rotulo} de ${linha.rotulo}`}
            aria-describedby={aviso ? idDoAviso : undefined}
            className="gap-1"
          />
        ))}
        <Texto variante="apoio" className="col-span-2 sm:col-span-3">
          {linha.resumo}
        </Texto>
        <Linha alinhar="centro" espaco={4} quebra className="col-span-2 sm:col-span-3">
          <CaixaDeMarcacao
            rotulo="Abono"
            name="abono"
            defaultChecked={linha.abono}
            disabled={!editavel}
          />
          {editavel && (
            <Button type="submit" disabled={pendente} aria-label={`Salvar ${linha.rotulo}`}>
              Salvar
            </Button>
          )}
        </Linha>
      </Grade>
      {aviso && (
        <Caixa id={idDoAviso} className="pt-1">
          <AvisoDeStatus tipo={aviso.tipo} legivel texto={aviso.texto} />
        </Caixa>
      )}
    </Caixa>
  );
}
