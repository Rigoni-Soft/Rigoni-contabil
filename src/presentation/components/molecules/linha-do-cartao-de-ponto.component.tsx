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

export type LinhaDoCartao = {
  data: string;
  rotulo: string;
  diaSemana: string;
  diaMes: string;
  entrada1: string;
  saida1: string;
  entrada2: string;
  saida2: string;
  extraEntrada: string;
  extraSaida: string;
  abono: boolean;
  nota?: string;
  tom?: "alerta" | "atencao" | "info";
  situacao: "normal" | "falta" | "abonado" | "folga" | "branco";
  trabalhado: string;
  atraso: string;
  extras: string;
  faixa1: string;
  faixa2: string;
  noturno: string;
};

export type AvisoDoDia = { tipo: "erro" | "sucesso"; texto: string };

type Props = {
  linha: LinhaDoCartao;
  editavel: boolean;
  emEdicao: boolean;
  limpa: boolean;
  pendente: boolean;
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

const CLASSE_DO_HORARIO =
  "w-[4.5rem] border-foreground/55 px-1.5 [&::-webkit-calendar-picker-indicator]:hidden";

export const idDoFormDoDia = (data: string) => `dia-${data}`;

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
  const semBatidaSalva = !linha.entrada1 && !linha.saida1 && !linha.entrada2 && !linha.saida2;
  const folgaSemBatida = linha.situacao === "folga" && semBatidaSalva;
  const batidasTravadas = abonado || folgaSemBatida;
  const primeiroCampo = batidasTravadas ? "extraEntrada" : "entrada1";
  return (
    <LinhaDeTabela tom={linha.tom}>
      <CelulaDeTabela fixa>
        <Texto como="span" variante="destaque">
          {linha.diaMes}
        </Texto>
        {linha.nota && (
          <Texto como="span" variante="apoio" className="block text-foreground">
            {linha.nota}
          </Texto>
        )}
      </CelulaDeTabela>
      <CelulaDeTabela>{linha.diaSemana}</CelulaDeTabela>
      {CAMPOS.map(([nome, rotulo]) => {
        const ehExtra = nome.startsWith("extra");
        const campoDesabilitado = ehExtra ? abonado : batidasTravadas;
        return (
          <CelulaDeTabela key={nome} compacta>
            <Input
              key={`${nome}|${emEdicao}`}
              autoFocus={focar && emEdicao && nome === primeiroCampo}
              type="time"
              form={idDoForm}
              name={nome}
              defaultValue={limpa ? "" : linha[nome]}
              readOnly={!destravada}
              disabled={campoDesabilitado}
              aria-label={`${rotulo} de ${linha.rotulo}`}
              aria-describedby={aviso ? idDoAviso : undefined}
              className={CLASSE_DO_HORARIO}
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
        {linha.abono && !limpa && !abonado && (
          <Input type="hidden" form={idDoForm} name="abono" value="on" readOnly />
        )}
        <Caixa
          como="form"
          id={idDoForm}
          aria-label={`Dia ${linha.rotulo}`}
          onSubmit={(evento) => {
            evento.preventDefault();
            onSalvar(linha.data, new FormData(evento.currentTarget));
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
