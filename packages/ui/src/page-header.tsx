/** Page title row: title + one-line context on the same row, actions pushed right. */
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
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-3 pt-2">
      <h1 className="font-display text-[22px] font-semibold leading-7 tracking-[-0.01em] text-ink">{title}</h1>
      {description && <div className="flex min-w-0 items-center gap-2 text-[13.5px] text-ink-muted">{description}</div>}
      {children && <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}
