const STORAGE_KEY = "ct_account_id";

const ACCOUNT_RE = /^[a-f0-9]{32}$/;

export function getStoredAccountId(): string | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw || !ACCOUNT_RE.test(raw)) return null;
  return raw;
}

export function setStoredAccountId(id: string) {
  localStorage.setItem(STORAGE_KEY, id);
}

export async function ensureAccountId(): Promise<string> {
  const existing = getStoredAccountId();
  const res = await fetch("/api/account/bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(existing ? { account_id: existing } : {}),
  });
  if (!res.ok) throw new Error(`Account bootstrap failed (${res.status})`);
  const data = await res.json();
  const id = data.account_id as string;
  if (!id || !ACCOUNT_RE.test(id)) throw new Error("Invalid account id from server");
  setStoredAccountId(id);
  return id;
}

export async function accountHeaders(): Promise<HeadersInit> {
  const accountId = await ensureAccountId();
  return {
    "X-Account-Id": accountId,
    "Content-Type": "application/json",
  };
}

export async function accountHeadersMultipart(): Promise<HeadersInit> {
  const accountId = await ensureAccountId();
  return { "X-Account-Id": accountId };
}
