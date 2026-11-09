// Sempre o primeiro item do formulário: `order-[-10000]` vence o `order-first` (-9999) de qualquer cabeçalho
// que suba ao topo (ex.: o mês do acompanhamento do RH), então nada fica acima dela.
export function NotaDeObrigatorio() {
  return (
    <p className="order-[-10000] text-xs text-muted-foreground">
      Campos com <span className="text-destructive">*</span> são obrigatórios.
    </p>
  );
}
