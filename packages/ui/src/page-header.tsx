/** Page title row: title + one-line context on the left, actions on the right. */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-title font-semibold text-ink">{title}</h1>
        {description && <div className="mt-2 flex items-center gap-2 text-sm text-ink-muted">{description}</div>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </header>
  );
}
