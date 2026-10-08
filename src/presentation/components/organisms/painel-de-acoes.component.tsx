type PainelDeAcoesProps = {
  // Nome do Setor para onde o Atendimento acabou de ir; troca as ações por um aviso.
  transferidoPara?: string;
  servicos: React.ReactNode;
  transferencia: React.ReactNode;
};

// Moldura do painel lateral: junta os serviços e a transferência. Em janela baixa rola por dentro.
export function PainelDeAcoes({ transferidoPara, servicos, transferencia }: PainelDeAcoesProps) {
  return (
    <aside
      aria-label="Ações do Atendimento"
      className="min-h-0 space-y-4 self-start overflow-y-auto rounded-xl border border-border bg-card p-3 lg:max-h-full"
    >
      {transferidoPara ? (
        <div role="status" className="space-y-1">
          <h2 className="font-semibold text-foreground">Atendimento transferido</h2>
          <p className="text-sm text-muted-foreground">
            Foi para o Setor {transferidoPara}. Você não acompanha mais esta conversa.
          </p>
        </div>
      ) : (
        <>
          {servicos}
          <div className="border-t border-border pt-3">{transferencia}</div>
        </>
      )}
    </aside>
  );
}
