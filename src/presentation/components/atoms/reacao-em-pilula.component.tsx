// Reação do escritório (emoji) abaixo do texto da Mensagem do cliente.
export function ReacaoEmPilula({ emoji }: { emoji: string }) {
  return (
    <span
      role="img"
      aria-label={`Reação do escritório: ${emoji}`}
      className="mt-1 inline-block rounded-full border border-border bg-background px-1.5 text-base"
    >
      {emoji}
    </span>
  );
}
