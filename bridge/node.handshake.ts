import { createHmac, randomUUID } from "node:crypto";
import {
  NodeHandshakeChallenge,
  NodeHandshakeResponse
} from "./node.types.js";

export class NodeHandshake {
  private readonly ttlMs: number;
  private readonly secret: string;
  private readonly challenges = new Map<string, NodeHandshakeChallenge>();

  constructor(input?: { ttlMs?: number; secret?: string }) {
    this.ttlMs = input?.ttlMs ?? 60_000;
    this.secret = input?.secret || process.env.KITTY_NODE_HANDSHAKE_SECRET || "kitty-bridge";
  }

  issue(nodeId: string, now = Date.now()): NodeHandshakeChallenge {
    const challenge_id = randomUUID();
    const expires_at = now + this.ttlMs;
    const challenge_token = this.sign(`${nodeId}:${challenge_id}:${expires_at}`);

    const challenge: NodeHandshakeChallenge = {
      node_id: nodeId,
      challenge_id,
      challenge_token,
      issued_at: now,
      expires_at
    };

    this.challenges.set(challenge_id, challenge);
    return challenge;
  }

  verify(response: NodeHandshakeResponse, now = Date.now()): boolean {
    const challenge = this.challenges.get(response.challenge_id);
    if (!challenge) {
      return false;
    }
    if (challenge.node_id !== response.node_id) {
      return false;
    }
    if (challenge.expires_at < now) {
      this.challenges.delete(response.challenge_id);
      return false;
    }

    const expected = this.sign(
      `${challenge.node_id}:${challenge.challenge_id}:${challenge.expires_at}:${challenge.challenge_token}`
    );
    const valid = expected === response.signature;
    if (valid) {
      this.challenges.delete(response.challenge_id);
    }
    return valid;
  }

  signResponse(challenge: NodeHandshakeChallenge): string {
    return this.sign(
      `${challenge.node_id}:${challenge.challenge_id}:${challenge.expires_at}:${challenge.challenge_token}`
    );
  }

  private sign(value: string): string {
    return createHmac("sha256", this.secret).update(value).digest("hex");
  }
}
