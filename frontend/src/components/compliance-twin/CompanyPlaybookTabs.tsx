import { useEffect, useState } from "react";

export interface PlaybookCompany {
  id: string;
  label: string;
  prefix: string;
}

interface Props {
  value: string;
  onChange: (companyId: string) => void;
  /** Compact layout inside assessment panel header */
  embedded?: boolean;
  /** Right-aligned strip above header company field */
  header?: boolean;
}

export function CompanyPlaybookTabs({ value, onChange, embedded, header }: Props) {
  const [companies, setCompanies] = useState<PlaybookCompany[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/playbook-companies")
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data.companies || []);
        setConnected(!!data.connected);
      })
      .catch(() => {
        setCompanies([
          { id: "vaisala", label: "Vaisala", prefix: "Vaisala" },
          { id: "iloq", label: "Iloq", prefix: "Iloq" },
          { id: "atlascopco", label: "Atlas Copco", prefix: "Atlascopco" },
        ]);
        setConnected(false);
      });
  }, []);

  const tabs = companies.length > 0 ? companies : [
    { id: "vaisala", label: "Vaisala", prefix: "Vaisala" },
    { id: "iloq", label: "Iloq", prefix: "Iloq" },
    { id: "atlascopco", label: "Atlas Copco", prefix: "Atlascopco" },
  ];

  const wrapClass = [
    "playbook-tabs-wrap",
    embedded ? "playbook-tabs-embedded" : "",
    header ? "playbook-tabs-header" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapClass}>
      <div className="playbook-tabs-label text-xs text-muted">
        Company playbook
        {connected === false && (
          <span className="badge badge-amber" style={{ marginLeft: 8 }}>
            offline
          </span>
        )}
        {connected === true && (
          <span className="badge badge-green" style={{ marginLeft: 8 }}>
            connected
          </span>
        )}
      </div>
      <div className="playbook-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={!value}
          className={`playbook-tab${!value ? " active" : ""}`}
          onClick={() => onChange("")}
        >
          None
        </button>
        {tabs.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={value === c.id}
            className={`playbook-tab${value === c.id ? " active" : ""}`}
            onClick={() => onChange(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
