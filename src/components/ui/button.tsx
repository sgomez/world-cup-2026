import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding font-text-medium font-semibold whitespace-nowrap transition-all duration-100 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95 active:opacity-50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:opacity-90 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive text-destructive-foreground hover:opacity-90 dark:bg-destructive dark:hover:opacity-90",
        link: "text-primary underline-offset-4 hover:underline",
        "outline-on-image":
          "bg-canvas text-ink hover:opacity-90 dark:bg-ink dark:text-canvas",
      },
      size: {
        default:
          "h-12 gap-2 px-8 text-base has-data-[icon=inline-end]:pr-6 has-data-[icon=inline-start]:pl-6",
        xs: "h-8 gap-1.5 rounded-[min(var(--radius-md),10px)] px-3 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-10 gap-1.5 rounded-[min(var(--radius-md),12px)] px-5 text-sm in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4 [&_svg:not([class*='size-'])]:size-3.5",
        "sm-compact": "h-9 gap-1.5 px-4 text-button-sm",
        lg: "h-14 gap-2 px-10 text-2xl has-data-[icon=inline-end]:pr-8 has-data-[icon=inline-start]:pl-8",
        icon: "size-10 rounded-full",
        "icon-xs":
          "size-6 rounded-full in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-full in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-12 rounded-full",
      },
      rounded: {
        none: "rounded-none",
        sm: "rounded-sm",
        md: "rounded-md",
        lg: "rounded-lg",
        xl: "rounded-xl",
        full: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface ButtonProps
  extends ButtonPrimitive.Props,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

function Button({
  className,
  variant = "default",
  size = "default",
  rounded,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, rounded, className }))}
      aria-busy={loading ? "true" : undefined}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" />}
      {children}
    </ButtonPrimitive>
  );
}

export type { ButtonProps };
export { Button, buttonVariants };
