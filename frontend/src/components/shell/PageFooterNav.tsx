interface FooterLink {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface Props {
  links: FooterLink[];
}

export function PageFooterNav({ links }: Props) {
  return (
    <footer className="ct-page-footer">
      <nav className="ct-page-footer-nav" aria-label="Page navigation">
        {links.map((link, index) => (
          <span key={link.label} className="ct-page-footer-item">
            {index > 0 && <span className="ct-page-footer-sep">·</span>}
            <button
              type="button"
              className="ct-page-footer-link"
              disabled={link.disabled}
              onClick={link.onClick}
            >
              {link.label}
            </button>
          </span>
        ))}
      </nav>
    </footer>
  );
}
