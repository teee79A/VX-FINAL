import { VYRDX_STANDARDS, type VyrdxAction, type VyrdxDecision, type VyrdxStandardId } from "./standards.js";

export type VyrdxCaseInput = {
  action: VyrdxAction;
  requesterEmail?: string;
  requesterName?: string;
  requesterRole?: "visitor" | "requester" | "customer_admin" | "vyrdx_reviewer" | "vyrdx_certifier" | "system";
  organization?: string;
  authorityDeclaration?: boolean;
  scopeType?: string;
  scopeDescription?: string;
  claim?: string;
  transactionId?: string;
  recordId?: string;
  caseId?: string;
  certificateId?: string;
  evidenceHash?: string;
  recordHash?: string;
  evidenceFiles?: string[];
  evidenceUrls?: string[];
  sourceConnection?: string;
  evidenceBundleId?: string;
  verifiedCaseId?: string;
  accessReason?: string;
  evidencePackageType?: "summary" | "full" | "audit-trail";
  authorizationProof?: string;
  accessProof?: string;
  accessToken?: string;
  otp?: string;
  signedLink?: string;
  selectedStandardId?: VyrdxStandardId;
  certificateScope?: string;
  certificationBasis?: string;
  reviewerOrPolicyAuthority?: string;
  expirationPolicy?: string;
  revocationPolicy?: string;
};

export type VyrdxGateResult = {
  ok: boolean;
  decision: VyrdxDecision;
  code: string;
  message: string;
  requiredFields: string[];
  applicableStandards: VyrdxStandardId[];
  boundaries: string[];
};

const PUBLIC_BOUNDARIES = [
  "VYRDX verifies bounded claims and records, not unsupported assertions.",
  "VYRDX certificates are limited to the stated scope, evidence bundle, standard, and issue time.",
  "VYRDX does not issue legal, financial, medical, government, insurance, or regulatory certification unless explicitly scoped and authorized.",
  "Email alone is never sufficient for verification, certification, evidence issuance, or live case access.",
];

function missing(input: VyrdxCaseInput, fields: Array<keyof VyrdxCaseInput>): string[] {
  return fields
    .filter((field) => {
      const value = input[field];
      if (Array.isArray(value)) return value.length === 0;
      return value === undefined || value === null || value === "" || value === false;
    })
    .map(String);
}

const VYRDX_EVIDENCE_ID_RE = /^evd_[a-z0-9-]+_[0-9]{8}T[0-9]{6}Z_[a-f0-9]{12,64}$/;
const VYRDX_SHA256_RE = /^[a-f0-9]{64}$/i;

function evidenceIdValid(id?: string): boolean {
  return Boolean(id && VYRDX_EVIDENCE_ID_RE.test(id));
}

function hashValid(hash?: string): boolean {
  return Boolean(hash && VYRDX_SHA256_RE.test(hash));
}

function invalidEvidenceReferences(input: VyrdxCaseInput): string[] {
  const invalid: string[] = [];

  if (input.evidenceBundleId && !evidenceIdValid(input.evidenceBundleId)) {
    invalid.push("evidenceBundleId must match VYRDX-EVIDENCE-STD-001");
  }

  if (input.evidenceHash && !hashValid(input.evidenceHash)) {
    invalid.push("evidenceHash must be sha256 hex");
  }

  if (input.recordHash && !hashValid(input.recordHash)) {
    invalid.push("recordHash must be sha256 hex");
  }

  return invalid;
}

function evidencePresent(input: VyrdxCaseInput): boolean {
  return Boolean(
    evidenceIdValid(input.evidenceBundleId) ||
      hashValid(input.evidenceHash) ||
      hashValid(input.recordHash) ||
      input.sourceConnection ||
      (input.evidenceFiles && input.evidenceFiles.length > 0) ||
      (input.evidenceUrls && input.evidenceUrls.length > 0),
  );
}

function standardsFor(action: VyrdxAction): VyrdxStandardId[] {
  return Object.values(VYRDX_STANDARDS)
    .filter((standard) => standard.requiredFor.includes(action))
    .map((standard) => standard.id);
}

function caseReferencePresent(input: VyrdxCaseInput): boolean {
  return Boolean(input.caseId || input.recordId || input.certificateId || input.evidenceHash || input.recordHash);
}

function liveAccessProofPresent(input: VyrdxCaseInput): boolean {
  return Boolean(input.accessProof || input.accessToken || input.otp || input.signedLink);
}

export function evaluateVyrdxGate(input: VyrdxCaseInput): VyrdxGateResult {
  const applicableStandards = standardsFor(input.action);

  switch (input.action) {
    case "verify_existing_record": {
      const hardRequired = missing(input, ["accessReason"]);
      if (!caseReferencePresent(input)) {
        hardRequired.push("recordId | certificateId | evidenceHash | recordHash");
      }

      hardRequired.push(...invalidEvidenceReferences(input));

      const emailMissing = missing(input, ["requesterEmail"]);
      const allRequired = [...emailMissing, ...hardRequired];

      if (hardRequired.length > 0) {
        return {
          ok: false,
          decision: "INCOMPLETE",
          code: "MISSING_RECORD_LOOKUP_REQUIREMENTS",
          message:
            "Existing-record verification requires a record ID, certificate ID, evidence hash, or record hash plus an access reason.",
          requiredFields: allRequired,
          applicableStandards,
          boundaries: PUBLIC_BOUNDARIES,
        };
      }

      return {
        ok: true,
        decision: "REVIEW_REQUIRED",
        code: "VERIFY_EXISTING_RECORD_ACCEPTED",
        message: "Existing-record verification request is accepted for lookup and decision processing.",
        requiredFields: emailMissing,
        applicableStandards,
        boundaries: PUBLIC_BOUNDARIES,
      };
    }

    case "verify_new_claim": {
      const hardRequired = missing(input, [
        "requesterName",
        "requesterRole",
        "organization",
        "authorityDeclaration",
        "scopeType",
        "scopeDescription",
        "claim",
        "transactionId",
        "selectedStandardId",
      ]);
      if (!evidencePresent(input)) {
        hardRequired.push("evidenceFiles | evidenceUrls | sourceConnection | evidenceHash | evidenceBundleId");
      }
      hardRequired.push(...invalidEvidenceReferences(input));

      const emailMissing = missing(input, ["requesterEmail"]);
      const allRequired = [...emailMissing, ...hardRequired];

      if (hardRequired.length > 0) {
        return {
          ok: false,
          decision: "INCOMPLETE",
          code: "MISSING_VERIFY_CLAIM_REQUIREMENTS",
          message:
            "VYRDX cannot verify a new claim until scope, authority, claim, transaction reference, standard, and evidence exist.",
          requiredFields: allRequired,
          applicableStandards,
          boundaries: PUBLIC_BOUNDARIES,
        };
      }

      return {
        ok: true,
        decision: "REVIEW_REQUIRED",
        code: "VERIFY_NEW_CLAIM_ACCEPTED",
        message: "New-claim verification request is accepted for evidence checks and decision processing.",
        requiredFields: emailMissing,
        applicableStandards,
        boundaries: PUBLIC_BOUNDARIES,
      };
    }

    case "certify_record": {
      const hardRequired = missing(input, [
        "verifiedCaseId",
        "requesterRole",
        "organization",
        "authorityDeclaration",
        "certificateScope",
        "certificationBasis",
        "evidenceBundleId",
        "reviewerOrPolicyAuthority",
        "expirationPolicy",
        "revocationPolicy",
        "selectedStandardId",
      ]);

      const emailMissing = missing(input, ["requesterEmail"]);
      const allRequired = [...emailMissing, ...hardRequired];

      if (hardRequired.length > 0) {
        return {
          ok: false,
          decision: "INCOMPLETE",
          code: "MISSING_CERTIFICATION_REQUIREMENTS",
          message:
            "VYRDX cannot certify until a verified case, certificate scope, evidence bundle, authority, standard, expiration policy, and revocation policy exist.",
          requiredFields: allRequired,
          applicableStandards,
          boundaries: PUBLIC_BOUNDARIES,
        };
      }

      return {
        ok: true,
        decision: "REVIEW_REQUIRED",
        code: "CERTIFICATION_REVIEW_REQUIRED",
        message:
          "Certification request is accepted for eligibility review. No certificate is issued until verification and authority pass.",
        requiredFields: emailMissing,
        applicableStandards,
        boundaries: PUBLIC_BOUNDARIES,
      };
    }

    case "request_evidence": {
      const hardRequired = missing(input, ["accessReason", "evidencePackageType", "authorizationProof"]);
      const hasPackageRef = Boolean(
        input.caseId || input.certificateId || input.recordHash || input.evidenceHash || input.evidenceBundleId,
      );
      if (!hasPackageRef) {
        hardRequired.push("caseId | certificateId | recordHash | evidenceHash | evidenceBundleId");
      }

      const emailMissing = missing(input, ["requesterEmail"]);
      const allRequired = [...emailMissing, ...hardRequired];

      if (hardRequired.length > 0) {
        return {
          ok: false,
          decision: "INCOMPLETE",
          code: "MISSING_EVIDENCE_REQUEST_REQUIREMENTS",
          message:
            "Evidence requests require a case/certificate/record reference, package type, access reason, and authorization proof.",
          requiredFields: allRequired,
          applicableStandards,
          boundaries: PUBLIC_BOUNDARIES,
        };
      }

      return {
        ok: true,
        decision: "REVIEW_REQUIRED",
        code: "EVIDENCE_ACCESS_REVIEW_REQUIRED",
        message: "Evidence package request is accepted for authorization review.",
        requiredFields: emailMissing,
        applicableStandards,
        boundaries: PUBLIC_BOUNDARIES,
      };
    }

    case "open_live_case": {
      const required = missing(input, ["requesterEmail", "caseId"]);
      if (!liveAccessProofPresent(input)) {
        required.push("accessProof | accessToken | otp | signedLink");
      }

      if (required.length > 0) {
        return {
          ok: false,
          decision: "INCOMPLETE",
          code: "MISSING_LIVE_CASE_ACCESS_REQUIREMENTS",
          message: "Live case access requires a case ID and access proof.",
          requiredFields: required,
          applicableStandards,
          boundaries: PUBLIC_BOUNDARIES,
        };
      }

      return {
        ok: true,
        decision: "REVIEW_REQUIRED",
        code: "LIVE_CASE_ACCESS_REVIEW_REQUIRED",
        message: "Live case access request is accepted for access verification.",
        requiredFields: [],
        applicableStandards,
        boundaries: PUBLIC_BOUNDARIES,
      };
    }
  }
}
