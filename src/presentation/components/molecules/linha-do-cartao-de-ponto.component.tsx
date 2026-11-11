import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { CaixaDeMarcacao } from "@/presentation/components/atoms/caixa-de-marcacao.component";
import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";

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
      <Linha alinhar="fim" espaco={3} quebra>
        <Texto como="span" variante="destaque" className="w-24 pb-2">
          {linha.rotulo}
          {linha.nota && (
            <Texto como="span" variante="nota" className="block">
              {linha.nota}
            </Texto>
          )}
        </Texto>
        {CAMPOS.map(([nome, rotulo]) => (
          <Caixa como="label" key={nome} className="flex flex-col gap-1 text-sm font-semibold">
            {rotulo}
            <Input
              type="time"
              name={nome}
              defaultValue={linha[nome]}
              // readOnly: em leitura o horário segue legível e focável (disabled o esmaece e tira da tabulação).
              readOnly={!editavel}
              aria-label={`${rotulo} de ${linha.rotulo}`}
              aria-describedby={aviso ? idDoAviso : undefined}
              className="w-28"
            />
          </Caixa>
        ))}
        <CaixaDeMarcacao
          rotulo="Abono"
          name="abono"
          defaultChecked={linha.abono}
          disabled={!editavel}
          className="pb-2"
        />
        {editavel && (
          <Button type="submit" size="sm" disabled={pendente} aria-label={`Salvar ${linha.rotulo}`}>
            Salvar
          </Button>
        )}
      </Linha>
      {aviso && (
        <Caixa id={idDoAviso} className="pt-1">
          <AvisoDeStatus tipo={aviso.tipo} legivel texto={aviso.texto} />
        </Caixa>
      )}
    </Caixa>
  );
}
