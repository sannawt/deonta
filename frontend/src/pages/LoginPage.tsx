import { useState, type FormEvent } from "react";

interface Props {
  onSignedIn?: () => void;
}

function friendlyFetchError(err: unknown): string {
  if (err instanceof TypeError) {
    return "Cannot reach the server. Run make run and open http://127.0.0.1:8001/";
  }
  return err instanceof Error ? err.message : "Could not send sign-in link";
}

export function LoginPage({ onSignedIn }: Props) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    setDevLink(null);
    try {
      const res = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(data.detail || `Request failed (${res.status})`));
      }
      setMessage(
        String(data.message || "Check your email for a sign-in link. It expires in 15 minutes."),
      );
      if (data.verify_url) {
        setDevLink(String(data.verify_url));
      }
      onSignedIn?.();
    } catch (err) {
      setError(friendlyFetchError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ct-page ct-app-page ct-login-page">
      <div className="ct-panel ct-login-panel">
        <header className="ct-app-page-header">
          <h1 className="ct-dashboard-title">Sign in</h1>
        </header>
        <p className="ct-page-sub">
          Enter your work email and we will send a one-time sign-in link.
        </p>

        <form className="ct-login-form" onSubmit={handleSubmit}>
          <label className="ct-login-label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            className="ct-login-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            autoComplete="email"
            disabled={submitting}
          />
          <button type="submit" className="ct-btn-primary ct-login-submit" disabled={submitting}>
            {submitting ? "Sending…" : "Send sign-in link"}
          </button>
        </form>

        {error ? <p className="ct-login-error">{error}</p> : null}
        {message ? <p className="ct-login-message">{message}</p> : null}
        {devLink ? (
          <p className="ct-login-dev">
            Dev link:{" "}
            <a href={devLink} className="ct-login-dev-link">
              Open sign-in link
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
}
