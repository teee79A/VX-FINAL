import { describe, expect, it } from "vitest";
import { NodeRegistry } from "../bridge/node.registry.js";
import { BridgeResolver } from "../bridge/bridge.resolver.js";
import { BridgePolicy } from "../bridge/bridge.policy.js";
import { NodeHeartbeat } from "../bridge/node.heartbeat.js";
import { NodeHandshake } from "../bridge/node.handshake.js";
import { buildBridgeRequest } from "../bridge/bridge.request.js";

describe("bridge layer", () => {
  it("blocks runtime capability elevation in node registry", () => {
    const registry = new NodeRegistry();
    registry.register({
      node_id: "tuning-lab",
      endpoint: "http://tuning-lab.local:9000",
      status: "online",
      trust_level: "trusted",
      capabilities: ["gpu.inference"],
      last_heartbeat_at: Date.now()
    });

    expect(() =>
      registry.register({
        node_id: "tuning-lab",
        endpoint: "http://tuning-lab.local:9000",
        status: "online",
        trust_level: "trusted",
        capabilities: ["gpu.inference", "brain.openrouter"],
        last_heartbeat_at: Date.now()
      })
    ).toThrow("Node capabilities are immutable");
  });

  it("resolves nodes by capability and trust order", () => {
    const registry = new NodeRegistry();
    registry.register({
      node_id: "restricted-node",
      endpoint: "http://restricted.local:9000",
      status: "online",
      trust_level: "restricted",
      capabilities: ["gpu.inference"],
      last_heartbeat_at: Date.now()
    });
    registry.register({
      node_id: "trusted-node",
      endpoint: "http://trusted.local:9000",
      status: "online",
      trust_level: "trusted",
      capabilities: ["gpu.inference"],
      last_heartbeat_at: Date.now() - 10_000
    });

    const resolver = new BridgeResolver(registry, new BridgePolicy());
    const request = buildBridgeRequest({
      type: "brain.inference.request",
      source: "operator",
      target: "vxstation.bridge.dispatch",
      payload: {},
      reason: "route by capability",
      required_capabilities: ["gpu.inference"]
    });
    const resolution = resolver.resolve(request);
    expect(resolution.node.node_id).toBe("trusted-node");
    expect(resolution.strategy).toBe("capability_match");
  });

  it("marks stale nodes offline from heartbeat layer", () => {
    const now = Date.now();
    const registry = new NodeRegistry();
    registry.register({
      node_id: "thunder",
      endpoint: "http://thunder.local:9000",
      status: "online",
      trust_level: "trusted",
      capabilities: ["thunder.workspace"],
      last_heartbeat_at: now - 60_000
    });

    const heartbeat = new NodeHeartbeat(registry, 30_000);
    const stale = heartbeat.markStale(now);

    expect(stale).toContain("thunder");
    expect(registry.get("thunder")?.status).toBe("offline");
  });

  it("issues and verifies node handshakes", () => {
    const handshake = new NodeHandshake({
      ttlMs: 10_000,
      secret: "test-secret"
    });
    const challenge = handshake.issue("tuning-lab", 100);
    const signature = handshake.signResponse(challenge);

    const ok = handshake.verify(
      {
        node_id: "tuning-lab",
        challenge_id: challenge.challenge_id,
        signature
      },
      200
    );
    expect(ok).toBe(true);
  });

  it("rejects expired handshake responses", () => {
    const handshake = new NodeHandshake({
      ttlMs: 10,
      secret: "test-secret"
    });
    const challenge = handshake.issue("codex", 100);
    const signature = handshake.signResponse(challenge);

    const ok = handshake.verify(
      {
        node_id: "codex",
        challenge_id: challenge.challenge_id,
        signature
      },
      500
    );
    expect(ok).toBe(false);
  });
});
