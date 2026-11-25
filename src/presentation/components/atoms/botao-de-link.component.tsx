import { Button } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

export function BotaoDeLink({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <Button
      type="button"
      variant="link"
      className={cn("-ml-2 h-auto min-h-11 px-2", className)}
      {...props}
    />
  );
}
