import { Label } from "@/presentation/components/ui/label";
import { Textarea } from "@/presentation/components/ui/textarea";
import { cn } from "@/presentation/lib/utils";

type CampoTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  rotulo: string;
  // Rótulo só para leitor de tela (o placeholder já diz o que escrever).
  rotuloOculto?: boolean;
};

export function CampoTextarea({
  id,
  rotulo,
  rotuloOculto = false,
  className,
  ...props
}: CampoTextareaProps) {
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <Label htmlFor={id} className={cn("text-xs", rotuloOculto && "sr-only")}>
        {rotulo}
      </Label>
      <Textarea id={id} className={className} {...props} />
    </div>
  );
}
