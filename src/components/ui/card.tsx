import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "border border-hairline bg-canvas dark:border-ash dark:bg-ink",
  {
    variants: {
      size: {
        default: "rounded-xl p-4",
        compact: "rounded-lg p-3",
      },
      variant: {
        default: "shadow-sm",
        interactive: "shadow-sm transition-all hover:shadow-md",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  },
);

const cardHeaderVariants = cva("border-b border-hairline dark:border-ash", {
  variants: {
    size: {
      default: "pb-2",
      compact: "pb-1 border-hairline/25 dark:border-ash/25",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

const cardBodyVariants = cva("", {
  variants: {
    size: {
      default: "",
      compact: "",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

const cardFooterVariants = cva(
  "border-t border-hairline/50 dark:border-ash/50",
  {
    variants: {
      size: {
        default: "pt-2",
        compact: "pt-1",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

type CardSize = "default" | "compact";
type CardVariant = "default" | "interactive";

interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

interface CardPartProps extends HTMLAttributes<HTMLDivElement> {
  size?: CardSize;
}

function Card({ className, size, variant, children, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ size, variant }), className)}
      {...props}
    >
      {children}
    </div>
  );
}

function CardHeader({ className, size, children, ...props }: CardPartProps) {
  return (
    <div
      data-slot="card-header"
      className={cn(cardHeaderVariants({ size }), className)}
      {...props}
    >
      {children}
    </div>
  );
}

function CardBody({ className, size, children, ...props }: CardPartProps) {
  return (
    <div
      data-slot="card-body"
      className={cn(cardBodyVariants({ size }), className)}
      {...props}
    >
      {children}
    </div>
  );
}

function CardFooter({ className, size, children, ...props }: CardPartProps) {
  return (
    <div
      data-slot="card-footer"
      className={cn(cardFooterVariants({ size }), className)}
      {...props}
    >
      {children}
    </div>
  );
}

export type { CardPartProps, CardProps, CardSize, CardVariant };
export { Card, CardBody, CardFooter, CardHeader, cardVariants };
