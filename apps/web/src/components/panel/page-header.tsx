import * as React from "react";

import { PageHeader as Header, cn } from "@granola/ui";

type PageHeaderProps = {
  title: string;
  description?: string;
  /** Acciones a la derecha (botones). */
  children?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <Header
      title={title}
      description={description}
      className={cn(
        "[&_h1]:sr-only md:[&_h1]:not-sr-only [&>div:first-child]:max-md:hidden",
        className,
      )}
    >
      {children}
    </Header>
  );
}
