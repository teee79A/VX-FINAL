import {
  calculateIQ200WeightedScore,
  enforceIQ200,
  type VyrdxBusinessAnswerPacket,
  type VyrdxDealState,
  type VyrdxIQ200Packet,
  type VyrdxIQ200State,
  type VyrdxQ201GateState,
} from "../../server/vyrdx/domain/business-gate.js";

export function makeIQ200Packet(scoreValue: number): VyrdxIQ200Packet {
  const scores = {
    contextClarity: scoreValue,
    scopeClarity: scoreValue,
    buyerFit: scoreValue,
    marketFit: scoreValue,
    evidenceStrength: scoreValue,
    riskControl: scoreValue,
    deploymentReadiness: scoreValue,
    metadataCompleteness: scoreValue,
    orchestratorIntegrity: scoreValue,
    weightedScore: 0,
  };
  scores.weightedScore = calculateIQ200WeightedScore(scores);
  const state: VyrdxIQ200State = scores.weightedScore >= 95
    ? "IQ_CERTIFIED"
    : scores.weightedScore >= 85
      ? "IQ_PASS"
      : scores.weightedScore >= 80
        ? "IQ_SCORE_REVIEW"
        : "IQ_BLOCKED";

  return {
    packetId: `iq200-${scoreValue}`,
    qid: "IQ200",
    createdAt: "2026-05-07T00:00:00.000Z",
    createdBy: "VYRDX",
    approvedBy: "ANCHOR",
    businessIdentity: {
      businessName: "Agency Alpha",
      buyerRole: "Founder",
      decisionAuthority: true,
      segment: "digital_marketing_agency",
      market: "B2B verification and certification",
    },
    intelligenceContext: {
      problemStatement: "Agency needs proof-backed deployment and client delivery claims.",
      operationalPain: ["client proof is scattered", "delivery status is manual"],
      currentSystemState: "Manual reporting and unsealed client evidence.",
      desiredOutcome: "Evidence-backed readiness packet before approach.",
      urgencyLevel: "HIGH",
    },
    scopeIntelligence: {
      scopeType: "READINESS_AUDIT",
      inScope: ["public proof review", "billing readiness", "deployment evidence"],
      outOfScope: ["legal certification"],
      assumptions: ["buyer controls agency operations"],
      constraints: ["no payment path until Q201 payment gate"],
      dependencies: ["ANCHOR review"],
    },
    evidenceMap: {
      evidenceRequired: ["source page", "audit artifact"],
      evidenceProvided: ["https://example.com", "evidence://audit/q201"],
      missingEvidence: [],
      sourceLinks: ["https://example.com"],
      auditArtifacts: ["evidence://audit/q201"],
    },
    riskMap: {
      technicalRisk: 20,
      commercialRisk: 20,
      complianceRisk: 20,
      deliveryRisk: 20,
      reputationRisk: 20,
      riskNotes: ["bounded readiness offer only"],
    },
    iqScore: scores,
    gateResult: {
      state,
      businessApproachAllowed: scores.weightedScore >= 85,
      q201Allowed: scores.weightedScore >= 85,
      paymentAllowed: false,
      crmWriteAllowed: scores.weightedScore >= 85,
      deploymentAllowed: false,
      reasons: [],
      requiredCorrections: [],
    },
    metadata: {
      leadSource: "market_target_registry",
      channel: "operator_review",
      auditStamp: "IQ200_ENFORCED_PRE_Q201",
    },
    orchestrator: {
      commandOwner: "ANCHOR",
      runtimeOwner: "VYRDX",
      executor: "CODEX",
      monitor: "KITTY",
      evidenceReturn: "ANCHOR",
    },
  };
}

export function makeQ201Packet(
  iq200: VyrdxIQ200Packet,
  gateState: VyrdxQ201GateState,
): VyrdxBusinessAnswerPacket {
  const iqState = enforceIQ200(iq200).state;
  return {
    packetId: `q201-${gateState}`,
    qid: "Q201",
    createdAt: "2026-05-07T00:01:00.000Z",
    createdBy: "VYRDX",
    approvedBy: "ANCHOR",
    who: {
      businessName: "Agency Alpha",
      buyerRole: "Founder",
      decisionAuthority: true,
      segment: "digital_marketing_agency",
    },
    toWhom: {
      businessName: "Agency Alpha",
      buyerRole: "Founder",
      channel: "email",
    },
    how: {
      approachType: "evidence-backed_readiness_offer",
      channel: "email",
      offerRoute: "/app?offer=readiness-audit",
    },
    when: {
      eligibilityWindow: "after IQ200 pass and ANCHOR review",
      trigger: "buyer has source-backed pain and scoped readiness need",
    },
    what: {
      offerName: "VYRDX readiness audit",
      offerRoute: "/app?offer=readiness-audit",
      value: "Proof-backed readiness and certification packet for client delivery claims.",
    },
    scope: {
      scopeType: "READINESS_AUDIT",
      inScope: ["readiness audit", "proof packet", "deployment evidence review"],
      outOfScope: ["legal certification"],
    },
    target: {
      segment: "digital_marketing_agency",
      buyerTitles: ["Founder", "Operations Director"],
    },
    market: {
      category: "B2B verification and certification",
      entryReason: "Agencies need proof-backed client delivery evidence.",
    },
    position: {
      statement: "VYRDX certifies bounded operational evidence before business motion.",
      differentiation: "Evidence-first gate, no self-approved sales motion.",
    },
    standard: {
      qid: "Q201",
      predecessor: "IQ200",
      governingStandard: "IQ200_PRE_Q201_BUSINESS_APPROACH_GATE",
    },
    "code/state": {
      qid: "Q201",
      gateState,
      guard: "canRunQ201",
      iq200State: iqState,
    },
    from: {
      authority: "ANCHOR",
      system: "VYRDX",
      executor: "CODEX",
    },
    to: {
      businessName: "Agency Alpha",
      buyerRole: "Founder",
      destination: "crm",
    },
    deal: {
      state: dealStateForGate(gateState),
      allowed: gateState !== "BUSINESS_APPROACH_BLOCKED",
      owner: "ANCHOR",
    },
    metadata: {
      qid: "Q201",
      source: "market_target_registry",
      channel: "operator_review",
      owner: "ANCHOR",
      offerRoute: "/app?offer=readiness-audit",
      gateState,
      iq200PacketId: iq200.packetId,
      auditStamp: "Q201_APPROVED_FOR_BUSINESS_APPROACH",
    },
    orchestrator: {
      commandOwner: "ANCHOR",
      runtimeOwner: "VYRDX",
      executor: "CODEX",
      monitor: "KITTY",
      evidenceReturn: "ANCHOR",
    },
  };
}

function dealStateForGate(gateState: VyrdxQ201GateState): VyrdxDealState {
  if (gateState === "CRM_READY") return "CRM_READY";
  if (gateState === "PROPOSAL_READY") return "PROPOSAL_READY";
  if (gateState === "PAYMENT_READY") return "PAYMENT_READY";
  if (gateState === "DEPLOYMENT_READY") return "DEPLOYMENT_READY";
  return "APPROACH_READY";
}
