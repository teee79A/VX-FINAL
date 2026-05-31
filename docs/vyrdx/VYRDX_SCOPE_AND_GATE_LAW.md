# VYRDX Scope and Gate Law

## Definition

VYRDX is a verification, evidence, and certification-gating runtime for bounded digital claims, records, deployments, workflows, and operational transactions.

VYRDX does not certify people. VYRDX certifies bounded records or claims after required scope, evidence, requester authority, decision policy, and audit logging pass.

## Core Law

```txt
NO SCOPE → NO CASE
NO CASE → NO VERIFY
NO VERIFY PASS → NO CERTIFY
NO EVIDENCE BUNDLE → NO CERTIFICATE
NO AUTHORITY → NO ACCESS
NO LIVE CASE → NO LIVE VIEW
ROOT FALSE → PASS FALSE
```

## What VYRDX Verifies

- Record existence
- Record integrity
- Evidence completeness
- Claim-to-evidence match
- Requester authority
- Scope boundaries
- Runtime/deployment state
- Workflow completion state
- Audit trail continuity
- Certificate validity

## What VYRDX Does Not Verify

- Unsupported assertions
- Unscoped transactions
- Legal, financial, medical, government, insurance, or regulatory claims unless explicitly contracted, scoped, and authorized
- Human identity beyond requester authentication unless identity/KYC integrations exist
- Third-party records where requester authority is absent

## What VYRDX Certifies

A VYRDX certificate means a bounded claim or record passed a stated VYRDX standard at a specific time under a defined scope using a specific evidence bundle and decision policy.

A VYRDX certificate is not a legal, financial, medical, government, insurance, or regulatory certification unless explicitly stated in scope and backed by authorized review.

## Decisions

- INCOMPLETE: required fields or evidence are missing.
- REJECTED: required checks failed.
- REVIEW_REQUIRED: automation cannot decide or authority requires review.
- VERIFIED: claim matched required evidence under selected standard.
- CERTIFIED: verified claim was approved for certificate issuance under allowed scope.
- REVOKED: prior certificate is no longer valid.

## Required Fields

### Verify Existing Record

- record_id OR certificate_id OR evidence_hash OR record_hash
- requester_email
- access_reason

### Verify New Claim

- requester_email
- requester_name
- requester_role
- organization
- authority_declaration
- scope_type
- scope_description
- claim
- transaction_or_record_reference
- evidence_files OR evidence_urls OR source_connection
- selected_standard

### Certify Record

- verified_case_id
- requester_email
- requester_role
- organization
- certificate_scope
- certification_basis
- evidence_bundle_id
- reviewer_or_policy_authority
- expiration_policy
- revocation_policy

### Evidence Package

- case_id OR certificate_id OR record_hash
- requester_email
- access_reason
- evidence_package_type: summary | full | audit-trail
- authorization proof

### Live Case

- case_id
- requester_email
- access token / OTP / signed link

## Customer Answer

VYRDX verifies bounded claims and records. It certifies only scoped records that pass evidence, authority, integrity, and audit gates. Email alone can never verify, certify, issue evidence, or open live case access.

VYRDX evidence is tied to a case, record, certificate, hash, or transaction. VYRDX live status is private case visibility, not public theater. Anything without scope, evidence, authority, and audit trail is incomplete by law.
