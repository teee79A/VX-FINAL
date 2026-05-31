// consolab/authority.ts
// ConsoLab Authority — Key signing, attestation token generation, certificate issuance.
// This runs on the ASUS node (or any authority plane) and signs attestation tokens
// for VYRDX services that call in.

import { createHash, generateKeyPairSync, sign, verify, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";

// ── TYPES ──────────────────────────────────────────────────────────────────

export interface AttestationPayload {
  nodeId: string;
  releaseId: string;
  pcrHash: string;
  imaLogHash: string;
  issuedAtUTC: string;
  expiresAtUTC: string;
}

export interface AttestationToken {
  payload: AttestationPayload;
  signature: string;
  signatures: string[];
  quorumSatisfied: number;
  signerCount: number;
}

export interface SigningResult {
  ok: boolean;
  token?: AttestationToken;
  error?: string;
}

export interface CertificateRequest {
  nodeId: string;
  publicKey: string;
  purpose: "attestation" | "service" | "agent";
  requestedBy: string;
}

export interface IssuedCertificate {
  certId: string;
  nodeId: string;
  purpose: string;
  publicKeyHash: string;
  issuedAtUTC: string;
  expiresAtUTC: string;
  signature: string;
}

// ── CONFIG ─────────────────────────────────────────────────────────────────

const AUTHORITY_KEY_PATH = process.env.CONSOLAB_SIGNING_KEY_PATH
  ?? path.join(process.env.CONSOLAB_ROOT ?? "/home/t79/ASUS_AUTHORITY", "keys/signing.key");
const AUTHORITY_PUB_PATH = process.env.CONSOLAB_PUBLIC_KEY_PATH
  ?? path.join(process.env.CONSOLAB_ROOT ?? "/home/t79/ASUS_AUTHORITY", "keys/signing.pub");
const TOKEN_LIFETIME_MINUTES = Number(process.env.ATTESTATION_TOKEN_MINUTES ?? "20");
const CERT_LIFETIME_DAYS = Number(process.env.CONSOLAB_CERT_LIFETIME_DAYS ?? "365");
const EVIDENCE_LOG_PATH = process.env.CONSOLAB_EVIDENCE_LOG
  ?? path.join(process.env.CONSOLAB_ROOT ?? "/home/t79/ASUS_AUTHORITY", "evidence/signing.jsonl");

// ── HELPERS ────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function stableStringify(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

async function fileExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

// ── AUTHORITY ──────────────────────────────────────────────────────────────

export class Authority {
  private privateKey: string | null = null;
  private publicKey: string | null = null;

  async init(): Promise<void> {
    if (await fileExists(AUTHORITY_KEY_PATH)) {
      this.privateKey = await readFile(AUTHORITY_KEY_PATH, "utf8");
      this.publicKey = await readFile(AUTHORITY_PUB_PATH, "utf8");
    } else {
      console.log("[CONSOLAB] No signing key found, generating ed25519 keypair...");
      const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });
      await mkdir(path.dirname(AUTHORITY_KEY_PATH), { recursive: true });
      await writeFile(AUTHORITY_KEY_PATH, privateKey, { mode: 0o600 });
      await writeFile(AUTHORITY_PUB_PATH, publicKey, { mode: 0o644 });
      this.privateKey = privateKey;
      this.publicKey = publicKey;
      console.log(`[CONSOLAB] Keys written to ${AUTHORITY_KEY_PATH}`);
    }
  }

  getPublicKey(): string {
    if (!this.publicKey) throw new Error("Authority not initialized");
    return this.publicKey;
  }

  // ── ATTESTATION TOKEN SIGNING ────────────────────────────────────────────

  async signAttestationToken(request: {
    nodeId: string;
    releaseId: string;
    pcrHash: string;
    imaLogHash: string;
  }): Promise<SigningResult> {
    if (!this.privateKey) return { ok: false, error: "Authority not initialized" };

    const now = new Date();
    const expires = new Date(now.getTime() + TOKEN_LIFETIME_MINUTES * 60 * 1000);

    const payload: AttestationPayload = {
      nodeId: request.nodeId,
      releaseId: request.releaseId,
      pcrHash: request.pcrHash,
      imaLogHash: request.imaLogHash,
      issuedAtUTC: now.toISOString(),
      expiresAtUTC: expires.toISOString(),
    };

    const payloadStr = stableStringify(payload as unknown as Record<string, unknown>);
    const signature = sign(null, Buffer.from(payloadStr), this.privateKey).toString("base64");

    const token: AttestationToken = {
      payload,
      signature,
      signatures: [signature],
      quorumSatisfied: 1,
      signerCount: 1,
    };

    await this.logEvidence("attestation_token_signed", {
      nodeId: request.nodeId,
      releaseId: request.releaseId,
      payloadHash: sha256(payloadStr),
      expiresAtUTC: expires.toISOString(),
    });

    return { ok: true, token };
  }

  // ── TOKEN VERIFICATION ───────────────────────────────────────────────────

  verifyToken(token: AttestationToken): boolean {
    if (!this.publicKey) return false;

    const payloadStr = stableStringify(token.payload as unknown as Record<string, unknown>);
    try {
      return verify(null, Buffer.from(payloadStr), this.publicKey, Buffer.from(token.signature, "base64"));
    } catch {
      return false;
    }
  }

  // ── CERTIFICATE ISSUANCE ─────────────────────────────────────────────────

  async issueCertificate(request: CertificateRequest): Promise<IssuedCertificate> {
    if (!this.privateKey) throw new Error("Authority not initialized");

    const now = new Date();
    const expires = new Date(now.getTime() + CERT_LIFETIME_DAYS * 24 * 60 * 60 * 1000);

    const cert: Omit<IssuedCertificate, "signature"> = {
      certId: randomUUID(),
      nodeId: request.nodeId,
      purpose: request.purpose,
      publicKeyHash: sha256(request.publicKey),
      issuedAtUTC: now.toISOString(),
      expiresAtUTC: expires.toISOString(),
    };

    const certStr = stableStringify(cert as unknown as Record<string, unknown>);
    const signature = sign(null, Buffer.from(certStr), this.privateKey).toString("base64");

    const issuedCert: IssuedCertificate = { ...cert, signature };

    await this.logEvidence("certificate_issued", {
      certId: cert.certId,
      nodeId: request.nodeId,
      purpose: request.purpose,
      publicKeyHash: cert.publicKeyHash,
      requestedBy: request.requestedBy,
    });

    return issuedCert;
  }

  // ── EVIDENCE LOG ─────────────────────────────────────────────────────────

  private async logEvidence(event: string, data: Record<string, unknown>): Promise<void> {
    const entry = {
      timestamp: new Date().toISOString(),
      event,
      ...data,
      authorityKeyHash: this.publicKey ? sha256(this.publicKey) : "UNKNOWN",
    };
    await mkdir(path.dirname(EVIDENCE_LOG_PATH), { recursive: true });
    const line = JSON.stringify(entry) + "\n";
    const _tmpPath = `${EVIDENCE_LOG_PATH}.${process.pid}.tmp`;
    const { appendFile } = await import("node:fs/promises");
    await appendFile(EVIDENCE_LOG_PATH, line);
  }
}

// ── SINGLETON ──────────────────────────────────────────────────────────────

let _authority: Authority | null = null;

export async function getAuthority(): Promise<Authority> {
  if (!_authority) {
    _authority = new Authority();
    await _authority.init();
  }
  return _authority;
}
