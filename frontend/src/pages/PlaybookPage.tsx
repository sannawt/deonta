import { PlaybookSelector } from "../components/product/PlaybookSelector";
import { setSelectedPlaybookId } from "../lib/playbookSelection";

interface Props {
  onNavigateHome: () => void;
  selectedPlaybookId: string | null;
  onSelectPlaybook: (id: string) => void;
}

export function PlaybookPage({ onNavigateHome, selectedPlaybookId, onSelectPlaybook }: Props) {
  return (
    <div className="ct-page ct-app-page ct-playbook-page">
      <header className="ct-app-page-header ct-workspace-header">
        <div>
          <h1 className="ct-dashboard-title">Company context</h1>
          <p className="ct-page-sub">
            Upload policies, DPAs, and vendor documents. Selected playbook is used in regulatory scoping.
          </p>
        </div>
        <button type="button" className="ct-btn-secondary" onClick={onNavigateHome}>
          Back to workspace
        </button>
      </header>

      <section className="ct-panel ct-playbook-page-panel">
        <PlaybookSelector
          selectedId={selectedPlaybookId}
          onSelect={(id) => {
            setSelectedPlaybookId(id);
            onSelectPlaybook(id);
          }}
        />
      </section>
    </div>
  );
}
