import { CalendarCheck, CalendarX, Check, Pencil, X } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
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
  // Falta, folga, feriado ou hora extra: aparece sob a data (a cor da linha nunca vai sozinha).
  nota?: string;
  // Estado do dia na cor da linha: falta (alerta), folga/feriado (atencao), hora extra (info), dia normal (sem tom).
  tom?: "alerta" | "atencao" | "info";
  // O que a linha deixa digitar e a ação que mostra:
  // abonado (travado; "Desfazer abono"), falta (travado até o lápis; "Abonar"), folga (sem jornada ou feriado: só a
  // coluna Extra), em branco (cartão sem dados: neutro) e normal.
  situacao: "normal" | "falta" | "abonado" | "folga" | "branco";
  // H. Diária, Atrasos, Horas Extras, 1ª e 2ª faixa e Adicional noturno do dia, como na planilha.
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
  // Sem edição (Líder, Admin ou outro Responsável), não há ações e os campos ficam travados.
  editavel: boolean;
  // A linha aberta para digitar: os campos destravam e as ações viram Salvar e Cancelar.
  emEdicao: boolean;
  // "Limpar" da tabela: a linha em edição aparece com os campos vazios (até salvar ou cancelar).
  limpa: boolean;
  pendente: boolean;
  // O foco do teclado vai para esta linha: o botão que a ação clicada fez sumir não o deixa cair no <body>.
  focar: boolean;
  aviso?: AvisoDoDia;
  onEditar: (data: string) => void;
  onAbonar: (data: string) => void;
  onDesfazerAbono: (data: string) => void;
  onCancelar: (data: string) => void;
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

// O id do formulário do dia: a tela o acha para salvar várias linhas de uma vez ("Salvar" da tabela).
export const idDoFormDoDia = (data: string) => `dia-${data}`;

// Um dia do Cartão de ponto como linha da tabela (a planilha): data, batidas, Abono, colunas calculadas e a
// ação do dia, um botão de ícone: lápis para editar; em edição, salvar e cancelar. O formulário do dia fica na
// última célula e os campos das outras o alcançam pelo atributo `form` (um <form> não envolve células de uma linha).
// ponytail: dois pares de batida + Extra na tela (o banco guarda até quatro); mais pares quando um cartão pedir.
export function LinhaDoCartaoDePonto({
  linha,
  editavel,
  emEdicao,
  limpa,
  pendente,
  focar,
  aviso,
  onEditar,
  onAbonar,
  onDesfazerAbono,
  onCancelar,
  onSalvar,
}: Props) {
  const idDoForm = idDoFormDoDia(linha.data);
  const idDoAviso = `aviso-${linha.data}`;
  const destravada = editavel && emEdicao;
  const abonado = linha.situacao === "abonado";
  // Dia abonado não tem horário; folga e feriado só têm a coluna Extra (toda hora trabalhada neles é extra),
  // salvo se já houver batida salva (nada some sem querer).
  const semBatidaSalva = !linha.entrada1 && !linha.saida1 && !linha.entrada2 && !linha.saida2;
  const batidasTravadas = abonado || (linha.situacao === "folga" && semBatidaSalva);
  const primeiroCampo = batidasTravadas ? "extraEntrada" : "entrada1";
  return (
    <LinhaDeTabela tom={linha.tom}>
      <CelulaDeTabela fixa>
        <Texto como="span" variante="destaque">
          {linha.diaMes}
        </Texto>
        {linha.nota && (
          // Único indicador não cromático do estado: em `apoio` (14 px) e na cor do texto, não apagado.
          <Texto como="span" variante="apoio" className="block text-foreground">
            {linha.nota}
          </Texto>
        )}
      </CelulaDeTabela>
      <CelulaDeTabela>{linha.diaSemana}</CelulaDeTabela>
      {CAMPOS.map(([nome, rotulo]) => {
        const ehExtra = nome.startsWith("extra");
        const desabilitado = ehExtra ? abonado : batidasTravadas;
        return (
          <CelulaDeTabela key={nome} compacta>
            <Input
              // A chave refaz o campo ao abrir e fechar a edição: o foco vai ao primeiro campo habilitado.
              key={`${nome}|${emEdicao}`}
              autoFocus={focar && emEdicao && nome === primeiroCampo}
              type="time"
              form={idDoForm}
              name={nome}
              defaultValue={limpa ? "" : linha[nome]}
              // readOnly: fora da edição o horário segue legível e focável (disabled o esmaece e tira da tabulação).
              readOnly={!destravada}
              disabled={desabilitado}
              aria-label={`${rotulo} de ${linha.rotulo}`}
              aria-describedby={aviso ? idDoAviso : undefined}
              // Borda mais forte que a padrão: sobre a linha com tom ela precisa de 3:1 (WCAG 1.4.11).
              className="w-[4.5rem] border-foreground/55 px-1.5 [&::-webkit-calendar-picker-indicator]:hidden"
            />
          </CelulaDeTabela>
        );
      })}
      <CelulaDeTabela numerica>{linha.trabalhado}</CelulaDeTabela>
      <CelulaDeTabela numerica>{linha.atraso}</CelulaDeTabela>
      <CelulaDeTabela numerica>{linha.extras}</CelulaDeTabela>
      <CelulaDeTabela numerica>{linha.noturno}</CelulaDeTabela>
      <CelulaDeTabela numerica>{linha.faixa1}</CelulaDeTabela>
      <CelulaDeTabela numerica>{linha.faixa2}</CelulaDeTabela>
      <CelulaDeTabela compacta>
        {/* Sem coluna Abono: o abono de dia com batida (atraso abonado) segue gravado ao salvar. */}
        {linha.abono && !limpa && !abonado && (
          <Input type="hidden" form={idDoForm} name="abono" value="on" readOnly />
        )}
        <Caixa
          como="form"
          id={idDoForm}
          aria-label={`Dia ${linha.rotulo}`}
          onSubmit={(e) => {
            e.preventDefault();
            onSalvar(linha.data, new FormData(e.currentTarget));
          }}
        >
          {editavel && !emEdicao && abonado && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={pendente}
              onClick={() => onDesfazerAbono(linha.data)}
              autoFocus={focar}
              aria-label={`Desfazer abono de ${linha.rotulo}`}
            >
              <CalendarX className="size-4" aria-hidden="true" />
            </Button>
          )}
          {editavel && !emEdicao && !abonado && (
            <Linha espaco={1} alinhar="centro">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={pendente}
                onClick={() => onEditar(linha.data)}
                autoFocus={focar}
                aria-label={`Editar ${linha.rotulo}`}
              >
                <Pencil className="size-4" aria-hidden="true" />
              </Button>
              {/* Falta: um clique troca a falta por abonada (sem digitar horário). */}
              {linha.situacao === "falta" && (
                <Button
                  type="button"
                  variant="warning"
                  size="icon"
                  disabled={pendente}
                  onClick={() => onAbonar(linha.data)}
                  aria-label={`Abonar ${linha.rotulo}`}
                >
                  <CalendarCheck className="size-4" aria-hidden="true" />
                </Button>
              )}
            </Linha>
          )}
          {editavel && emEdicao && (
            <Linha espaco={1} alinhar="centro">
              <Button
                type="submit"
                size="icon"
                disabled={pendente}
                aria-label={`Salvar ${linha.rotulo}`}
              >
                <Check className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={pendente}
                onClick={() => onCancelar(linha.data)}
                aria-label={`Cancelar edição de ${linha.rotulo}`}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </Linha>
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
