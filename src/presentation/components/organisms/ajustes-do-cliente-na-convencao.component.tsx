import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { CaixaDeMarcacao } from "@/presentation/components/atoms/caixa-de-marcacao.component";
import { Caixa, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Opcao } from "@/presentation/components/atoms/opcao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoSelect } from "@/presentation/components/molecules/campo-select.component";

export type EmpregadoDosAjustes = { id: string; nome: string; sindicato: string };

type Props = {
  bancoDeHoras: boolean;
  trabalhoAosDomingos: boolean;
  // Sindicatos das convenções do Cliente; o ponteiro por empregado só aparece com mais de um.
  sindicatos: string[];
  empregados: EmpregadoDosAjustes[];
  editavel: boolean;
  pendente: boolean;
  erro?: string;
  onBancoDeHoras: (ligado: boolean) => void;
  onTrabalhoAosDomingos: (ligado: boolean) => void;
  // Texto vazio = a única convenção do Cliente.
  onSindicato: (empregadoId: string, sindicato: string) => void;
};

// O que a convenção não decide: os interruptores do Cliente (banco de horas, desligado por padrão, e
// trabalho aos domingos) e, havendo mais de uma convenção, qual cada empregado segue.
export function AjustesDoClienteNaConvencao({
  bancoDeHoras,
  trabalhoAosDomingos,
  sindicatos,
  empregados,
  editavel,
  pendente,
  erro,
  onBancoDeHoras,
  onTrabalhoAosDomingos,
  onSindicato,
}: Props) {
  return (
    <Pilha como="section" espaco={4} aria-label="Ajustes do cliente">
      <Texto como="h2" variante="subtitulo">
        Ajustes do cliente
      </Texto>
      {erro && <AvisoDeStatus tipo="erro" legivel texto={erro} />}
      <Pilha espaco={2}>
        <CaixaDeMarcacao
          rotulo="Banco de horas"
          checked={bancoDeHoras}
          disabled={!editavel || pendente}
          onChange={(e) => onBancoDeHoras(e.target.checked)}
        />
        <CaixaDeMarcacao
          rotulo="Trabalho aos domingos"
          checked={trabalhoAosDomingos}
          disabled={!editavel || pendente}
          onChange={(e) => onTrabalhoAosDomingos(e.target.checked)}
        />
        {!editavel && (
          <Texto variante="nota">Só o Responsável do RH deste cliente altera estes ajustes.</Texto>
        )}
      </Pilha>
      {sindicatos.length > 1 && empregados.length > 0 && (
        <Pilha espaco={2}>
          <Texto como="h3" variante="rotuloDeSecao">
            Convenção de cada empregado
          </Texto>
          <Caixa className="grid gap-3 sm:grid-cols-2">
            {empregados.map((e) => (
              <CampoSelect
                key={e.id}
                id={`convencao-${e.id}`}
                rotulo={e.nome}
                value={e.sindicato}
                disabled={!editavel || pendente}
                onChange={(ev) => onSindicato(e.id, ev.target.value)}
              >
                <Opcao value="">Sem escolha (a única do cliente)</Opcao>
                {sindicatos.map((s) => (
                  <Opcao key={s} value={s}>
                    {s}
                  </Opcao>
                ))}
              </CampoSelect>
            ))}
          </Caixa>
        </Pilha>
      )}
    </Pilha>
  );
}
