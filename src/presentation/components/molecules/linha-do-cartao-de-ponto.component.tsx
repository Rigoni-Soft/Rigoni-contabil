import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { CaixaDeMarcacao } from "@/presentation/components/atoms/caixa-de-marcacao.component";
import { Caixa } from "@/presentation/components/atoms/caixa.component";
import {
  CelulaDeTabela,
  LinhaDeTabela,
} from "@/presentation/components/atoms/celula-de-tabela.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";

// Horários como "HH:MM" (vazio = não batido); as colunas calculadas já vêm formatadas ("9h45").
export type LinhaDoCartao = {
  data: string;
  // "seg 16/11": nome acessível dos campos do dia.
  rotulo: string;
  diaSemana: string;
  // "16/11".
  diaMes: string;
  entrada1: string;
  saida1: string;
  entrada2: string;
  saida2: string;
  extraEntrada: string;
  extraSaida: string;
  abono: boolean;
  // Feriado, falta ou folga: aparece sob a data.
  nota?: string;
  // H. Diária, Atrasos, Horas Extras, 1ª e 2ª faixa e A.N. do dia, como na planilha.
  trabalhado: string;
  atraso: string;
  extras: string;
  faixa1: string;
  faixa2: string;
  noturno: string;
};

// Resultado do último "Salvar" deste dia, na célula de ações dele (não no topo do cartão).
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

// Um dia do Cartão de ponto como linha da tabela (a planilha): data, batidas digitadas, Abono, colunas
// calculadas e o "Salvar" do dia. O formulário do dia fica na última célula; os campos das outras o
// alcançam pelo atributo `form` (um <form> não pode envolver as células de uma linha).
// ponytail: dois pares de batida + Extra na tela (o banco guarda até quatro); mais pares quando um cartão pedir.
export function LinhaDoCartaoDePonto({ linha, editavel, pendente, aviso, onSalvar }: Props) {
  const idDoForm = `dia-${linha.data}`;
  const idDoAviso = `aviso-${linha.data}`;
  return (
    <LinhaDeTabela>
      <CelulaDeTabela fixa>
        <Texto como="span" variante="destaque">
          {linha.diaMes}
        </Texto>
        {linha.nota && (
          <Texto como="span" variante="nota" className="block">
            {linha.nota}
          </Texto>
        )}
      </CelulaDeTabela>
      <CelulaDeTabela>{linha.diaSemana}</CelulaDeTabela>
      {CAMPOS.map(([nome, rotulo]) => (
        <CelulaDeTabela key={nome} compacta>
          <Input
            type="time"
            form={idDoForm}
            name={nome}
            defaultValue={linha[nome]}
            // readOnly: em leitura o horário segue legível e focável (disabled o esmaece e tira da tabulação).
            readOnly={!editavel}
            aria-label={`${rotulo} de ${linha.rotulo}`}
            aria-describedby={aviso ? idDoAviso : undefined}
            className="w-28 px-2"
          />
        </CelulaDeTabela>
      ))}
      <CelulaDeTabela numerica>{linha.trabalhado}</CelulaDeTabela>
      <CelulaDeTabela numerica>{linha.atraso}</CelulaDeTabela>
      <CelulaDeTabela centro>
        <CaixaDeMarcacao
          rotulo={`Abono de ${linha.rotulo}`}
          rotuloOculto
          form={idDoForm}
          name="abono"
          defaultChecked={linha.abono}
          disabled={!editavel}
          className="justify-center"
        />
      </CelulaDeTabela>
      <CelulaDeTabela numerica>{linha.extras}</CelulaDeTabela>
      <CelulaDeTabela numerica>{linha.noturno}</CelulaDeTabela>
      <CelulaDeTabela numerica>{linha.faixa1}</CelulaDeTabela>
      <CelulaDeTabela numerica>{linha.faixa2}</CelulaDeTabela>
      <CelulaDeTabela compacta>
        <Caixa
          como="form"
          id={idDoForm}
          aria-label={`Dia ${linha.rotulo}`}
          onSubmit={(e) => {
            e.preventDefault();
            onSalvar(linha.data, new FormData(e.currentTarget));
          }}
        >
          {editavel && (
            <Button type="submit" disabled={pendente} aria-label={`Salvar ${linha.rotulo}`}>
              Salvar
            </Button>
          )}
        </Caixa>
        {aviso && (
          <Caixa id={idDoAviso} className="pt-1">
            <AvisoDeStatus tipo={aviso.tipo} legivel texto={aviso.texto} />
          </Caixa>
        )}
      </CelulaDeTabela>
    </LinhaDeTabela>
  );
}
