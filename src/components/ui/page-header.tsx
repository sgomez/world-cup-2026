import type { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}

export function PageHeader({
  title,
  description,
  action,
  icon,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4 min-w-0 flex-1">
        {icon && (
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary mt-0.5">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-heading-xl font-medium uppercase tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <div className="text-caption-md text-muted-foreground">
              {description}
            </div>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
