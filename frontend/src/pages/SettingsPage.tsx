import { useAuth } from "../context/AuthContext";

function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] || "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase() || "?";
}

export function SettingsPage() {
  const { user, logout } = useAuth();
  const email = user?.email ?? "";
  const initials = email ? initialsFromEmail(email) : "?";

  return (
    <div className="ct-page ct-app-page">
      <header className="ct-app-page-header">
        <h1 className="ct-dashboard-title">Settings</h1>
      </header>

      <section className="ct-panel ct-settings-section">
        <h2 className="ct-card-title">Profile</h2>
        <div className="ct-settings-profile">
          <span className="ct-settings-avatar" aria-hidden>
            {initials}
          </span>
          <div>
            <p className="ct-settings-name">{email || "—"}</p>
          </div>
        </div>
      </section>

      <section className="ct-panel ct-settings-section">
        <h2 className="ct-card-title">Session</h2>
        <p className="ct-settings-hint">Sign out on this device.</p>
        <button type="button" className="ct-btn-secondary" onClick={() => void logout()}>
          Log out
        </button>
      </section>
    </div>
  );
}
