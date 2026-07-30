interface Props {
  title?: string | null;
  text?: string | null;
  excerpt?: string | null;
  className?: string;
}

export function ProvisionText({ title, text, excerpt, className = "scope-provision-text" }: Props) {
  const body = text?.trim() || excerpt?.trim();
  if (!body) return null;

  return (
    <blockquote className={className}>
      {title ? <div className="scope-provision-text-title">{title}</div> : null}
      {body}
    </blockquote>
  );
}
