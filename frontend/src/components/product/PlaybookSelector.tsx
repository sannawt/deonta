import { useEffect, useState } from "react";
import {
  createAccountPlaybook,
  fetchAccountPlaybooks,
  uploadPlaybookDocuments,
  type PlaybookSummary,
} from "../../lib/api";
import { ensureAccountId } from "../../lib/account";

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function PlaybookSelector({ selectedId, onSelect }: Props) {
  const [playbooks, setPlaybooks] = useState<PlaybookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      await ensureAccountId();
      const rows = await fetchAccountPlaybooks();
      setPlaybooks(rows);
      if (!selectedId && rows[0]?.playbook_id) {
        onSelect(rows[0].playbook_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load playbooks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const doc = await createAccountPlaybook(newName.trim());
      const id = doc.playbook_id as string;
      setNewName("");
      await reload();
      onSelect(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function handleCompanyUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedId) return;
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setError(null);
    try {
      await uploadPlaybookDocuments(selectedId, files);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
    e.target.value = "";
  }

  return (
    <div className="ct-playbook-bar">
      <label className="text-label">Company playbook</label>
      {loading ? (
        <p className="text-sm">Loading playbooks…</p>
      ) : playbooks.length === 0 ? (
        <div className="ct-playbook-create">
          <input
            className="input"
            placeholder="Company name"
            value={newName}
            onChange={(ev) => setNewName(ev.target.value)}
          />
          <button
            type="button"
            className="ct-btn-primary"
            disabled={creating || !newName.trim()}
            onClick={handleCreate}
          >
            {creating ? "Creating…" : "Create company playbook"}
          </button>
        </div>
      ) : (
        <div className="ct-playbook-row">
          <select
            className="input"
            value={selectedId ?? ""}
            onChange={(ev) => onSelect(ev.target.value)}
          >
            {playbooks.map((p) => (
              <option key={p.playbook_id} value={p.playbook_id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="New playbook name"
            value={newName}
            onChange={(ev) => setNewName(ev.target.value)}
          />
          <button
            type="button"
            className="ct-btn-secondary"
            disabled={creating || !newName.trim()}
            onClick={handleCreate}
          >
            Create new
          </button>
          {selectedId && (
            <label className="ct-btn-secondary ct-file-btn">
              Upload company docs
              <input
                type="file"
                multiple
                hidden
                accept=".pdf,.txt,.md,.doc,.docx"
                onChange={handleCompanyUpload}
              />
            </label>
          )}
        </div>
      )}
      {error && <div className="err">{error}</div>}
    </div>
  );
}
