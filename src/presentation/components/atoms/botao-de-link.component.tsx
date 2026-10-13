import { cn } from "@/presentation/lib/utils";

// Ação com aparência de link (sublinhada, na cor primária): alterna a exibição de um trecho.
export function BotaoDeLink({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "-ml-2 min-h-11 rounded-md px-2 font-medium text-primary underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  );
}
