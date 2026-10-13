type BarraDeProgressoProps = {
  // 0 a 100.
  porcentagem: number;
  // Classe `bg-*` do preenchimento (cor semântica da fatia).
  classe: string;
};

// Barra decorativa: o valor sempre aparece também como número ao lado.
export function BarraDeProgresso({ porcentagem, classe }: BarraDeProgressoProps) {
  return (
    <div aria-hidden className="h-2 rounded-full bg-border">
      <div className={`h-2 rounded-full ${classe}`} style={{ width: `${porcentagem}%` }} />
    </div>
  );
}
