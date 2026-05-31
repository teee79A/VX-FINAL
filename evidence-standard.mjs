export const STANDARD = "VYRDX-EVIDENCE-STD-001";

export const EVIDENCE_ID_RE =
  /^evd_[a-z0-9-]+_[0-9]{8}T[0-9]{6}Z_[a-f0-9]{12,64}$/;

export function verifyEvidenceRecord(id, registry = []) {
  if (typeof id !== "string" || id.trim() === "") {
    return {
      ok: false,
      status: "invalid",
      certified: false,
      reason: "EVIDENCE_ID_REQUIRED",
      standard: STANDARD
    };
  }

  if (!EVIDENCE_ID_RE.test(id)) {
    return {
      ok: false,
      status: "invalid",
      certified: false,
      reason: "EVIDENCE_ID_FORMAT_INVALID",
      standard: STANDARD
    };
  }

  const record = registry.find((r) => r.id === id);

  if (!record) {
    return {
      ok: false,
      status: "not_found",
      certified: false,
      reason: "EVIDENCE_ID_NOT_REGISTERED",
      standard: STANDARD,
      id
    };
  }

  if (record.status !== "verified") {
    return {
      ok: false,
      status: record.status || "invalid",
      certified: false,
      reason: "EVIDENCE_NOT_VERIFIED",
      standard: STANDARD,
      id
    };
  }

  return {
    ok: true,
    status: "verified",
    certified: true,
    reason: "EVIDENCE_VERIFIED",
    standard: STANDARD,
    id,
    demo: Boolean(record.demo)
  };
}
