// consolab/index.ts
// ConsoLab barrel export

export { Authority, getAuthority } from "./authority.js";
export type {
  AttestationPayload,
  AttestationToken,
  SigningResult,
  CertificateRequest,
  IssuedCertificate,
} from "./authority.js";

export { HeartbeatManager } from "./heartbeat.js";
export type {
  HeartbeatPayload,
  HeartbeatAck,
  NodeStatus,
} from "./heartbeat.js";
