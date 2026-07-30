import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export function AuthCallbackPage() {
  const { refresh } = useAuth();

  useEffect(() => {
    void refresh().then(() => {
      window.location.hash = "#/workspace";
    });
  }, [refresh]);

  return (
    <div className="ct-page ct-app-page">
      <p className="ct-page-sub">Signing you in…</p>
    </div>
  );
}
