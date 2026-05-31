// server/lib/mask.ts
// Mask sensitive values for safe display — never expose full bank/account numbers in API responses.

export function maskAccount(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, "");
  if (trimmed.length <= 4) return "*".repeat(trimmed.length);
  return `${"*".repeat(trimmed.length - 4)}${trimmed.slice(-4)}`;
}
