import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { BotaoDeLink } from "@/presentation/components/atoms/botao-de-link.component";
import { Linha } from "@/presentation/components/atoms/caixa.component";

type AvisoComAcaoProps = { texto: string; rotuloDaAcao: string; onAcao: () => void };

export function AvisoComAcao({ texto, rotuloDaAcao, onAcao }: AvisoComAcaoProps) {
  return (
    <Linha alinhar="centro" quebra espaco={2}>
      <AvisoDeStatus tipo="erro" texto={texto} className="text-sm" />
      <BotaoDeLink onClick={onAcao}>{rotuloDaAcao}</BotaoDeLink>
    </Linha>
  );
}
