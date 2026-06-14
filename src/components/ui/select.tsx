import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown } from "lucide-react";
import type { ReactNode, SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const selectVariants = cva(
  "appearance-none rounded-lg border border-hairline bg-canvas pl-4 pr-10 text-sm font-semibold text-ink dark:border-ash dark:bg-charcoal dark:text-canvas outline-none focus:border-ink dark:focus:border-canvas transition-colors",
  {
    variants: {
      size: {
        default: "py-2",
        lg: "h-12",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size">,
    VariantProps<typeof selectVariants> {
  /** Optional icon rendered as the right adornment. When omitted, defaults to ChevronDown. */
  icon?: ReactNode;
}

function Select({ icon, className, size, children, ...props }: SelectProps) {
  return (
    <div className="relative inline-block">
      <select className={cn(selectVariants({ size, className }))} {...props}>
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-mute dark:text-stone">
        {icon ?? <ChevronDown className="h-3.5 w-3.5" />}
      </div>
    </div>
  );
}

export type { SelectProps };
export { Select, selectVariants };
