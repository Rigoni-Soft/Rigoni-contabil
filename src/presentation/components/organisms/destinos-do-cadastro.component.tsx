import { Trash2 } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { ListaComDivisores } from "@/presentation/components/atoms/lista-com-divisores.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import {
  FormularioDeDestino,
  type FormularioDeDestinoValores,
} from "@/presentation/components/molecules/formulario-de-destino.component";
import { Button } from "@/presentation/components/ui/button";

export type LinhaDeDestinoDaTela = {
  id: string;
  tipo: string;
  contato: string;
  identificador: string;
  canal: string;
  // O canal do destino que o contato deixou de ter.
  aviso?: string;
};

export type DestinosDoCadastroProps = {
  linhas: LinhaDeDestinoDaTela[];
  formulario: FormularioDeDestinoValores;
  idDoSelect: string;
  // Confirmação dita ao leitor de tela ("Destino adicionado."), já que a tabela só ganha uma linha.
  aviso?: string;
  // Visualização: só a tabela, sem o formulário nem a lixeira.
  somenteLeitura: boolean;
  onEscolherContato: (id: string) => void;
  onMudarNovo: (campo: "nome" | "telefone" | "email", valor: string) => void;
  onMudarTipo: (tipo: string) => void;
  onMudarCanal: (canal: string) => void;
  onNovoContato: () => void;
  onVoltar: () => void;
  onUsarExistente: (id: string) => void;
  onAdicionar: () => void;
  onRemover: (id: string) => void;
};

// Os destinos de envio do Setor neste Cliente: a tabela (tipo de envio, contato, forma de envio, remover)
// e, embaixo, o formulário de adicionar destino.
export function DestinosDoCadastro({
  linhas,
  formulario,
  idDoSelect,
  aviso,
  somenteLeitura,
  onEscolherContato,
  onMudarNovo,
  onMudarTipo,
  onMudarCanal,
  onNovoContato,
  onVoltar,
  onUsarExistente,
  onAdicionar,
  onRemover,
}: DestinosDoCadastroProps) {
  return (
    <Pilha espaco={3} className="sm:col-span-2 lg:col-span-4">
      <Texto variante="titulo" id="destinos-titulo">
        Destinos de envio
      </Texto>
      {!somenteLeitura && (
        <Texto variante="nota">
          Para quem este Setor envia os documentos e avisos deste Cliente, e por qual canal.
        </Texto>
      )}
      {linhas.length === 0 ? (
        <Texto variante="apoio">Este Setor ainda não tem destino de envio neste Cliente.</Texto>
      ) : (
        <ListaComDivisores cartao aria-labelledby="destinos-titulo">
          {linhas.map((linha) => (
            <Caixa como="li" key={linha.id} className="px-3 py-2">
              <Linha alinhar="centro" justificar="entre" espaco={3}>
                <Pilha espaco={1} className="min-w-0 flex-1">
                  <Texto variante="destaque">{linha.tipo}</Texto>
                  <Texto variante="apoio">
                    {linha.contato}
                    {linha.identificador && ` · ${linha.identificador}`} · {linha.canal}
                  </Texto>
                  {linha.aviso && <AvisoDeStatus tipo="atencao" legivel texto={linha.aviso} />}
                </Pilha>
                {!somenteLeitura && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemover(linha.id)}
                    aria-label={`Remover destino ${linha.tipo} de ${linha.contato}`}
                    title={`Remover destino ${linha.tipo} de ${linha.contato}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                )}
              </Linha>
            </Caixa>
          ))}
        </ListaComDivisores>
      )}
      {!somenteLeitura && (
        <FormularioDeDestino
          valores={formulario}
          idDoSelect={idDoSelect}
          onEscolherContato={onEscolherContato}
          onMudarNovo={onMudarNovo}
          onMudarTipo={onMudarTipo}
          onMudarCanal={onMudarCanal}
          onNovoContato={onNovoContato}
          onVoltar={onVoltar}
          onUsarExistente={onUsarExistente}
          onAdicionar={onAdicionar}
        />
      )}
      <Texto variante="nota" aria-live="polite" className="sr-only">
        {aviso}
      </Texto>
    </Pilha>
  );
}
