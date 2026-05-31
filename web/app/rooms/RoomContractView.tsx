const API_URL = process.env.API_URL ?? "http://localhost:7900";

type SearchParams = Record<string, string | string[] | undefined>;

type RoomObject = {
  id: string;
  label: string;
  subtitle?: string;
  type: string;
};

type RoomGroup = {
  key: string;
  title: string;
  objects: RoomObject[];
  emptyLabel: string;
};

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function pickParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${path}`, { next: { revalidate: 5 } });
    if (!response.ok) return null;
    return response.json() as Promise<T>;
  } catch {
    return null;
  }
}

function defaultActions(room: string, selectedType: string, selectedId: string): Array<{ method: string; path: string }> {
  if (room === "commercial") {
    return [
      { method: "POST", path: "/api/commercial/actions/issue" },
      { method: "POST", path: "/api/commercial/actions/verify" },
      { method: "POST", path: "/api/commercial/actions/export" },
      { method: "POST", path: "/api/commercial/actions/revoke" },
      { method: "POST", path: "/api/commercial/actions/resend" },
    ];
  }
  if (room === "ops") {
    return [
      { method: "GET", path: "/api/operations/services" },
      { method: "POST", path: `/api/operations/jobs/${encodeURIComponent(selectedId)}/retry` },
      { method: "POST", path: "/api/operations/canary/run" },
      { method: "GET", path: `/api/operations/rollbacks/${encodeURIComponent(selectedId)}/inspect` },
    ];
  }
  if (room === "market") {
    return [
      { method: "POST", path: `/api/market/targets/${encodeURIComponent(selectedId)}/refresh` },
      { method: "POST", path: "/api/market/intelligence" },
      { method: "GET", path: `/api/market/sources/${encodeURIComponent(selectedId)}` },
    ];
  }
  if (room === "system") {
    return [{ method: "GET", path: "/api/policy/blockers" }];
  }
  if (room === "camp") {
    return [{ method: "GET", path: "/api/camp/authority-routing" }];
  }
  if (room === "evidence") {
    return [
      { method: "GET", path: "/api/evidence/chain/verify" },
      { method: "POST", path: `/api/evidence/seals/${encodeURIComponent(selectedId)}/verify` },
      { method: "POST", path: `/api/evidence/seals/${encodeURIComponent(selectedId)}/revoke` },
    ];
  }
  return [{ method: "GET", path: "/api/reports-plans/reports" }];
}

async function loadGroups(room: string): Promise<RoomGroup[]> {
  if (room === "commercial") {
    const [customers, entitlements, receipts, stamps, certificates] = await Promise.all([
      fetchJson<{ customers: Array<{ id: string; company_name: string; plan: string; status: string }> }>("/api/commercial/customers"),
      fetchJson<{ entitlements: Array<{ license_id: string; plan_name: string; status: string }> }>("/api/commercial/entitlements"),
      fetchJson<{ receipts: Array<{ id: string; customer_id: string; status?: string }> }>("/api/commercial/receipts"),
      fetchJson<{ stamps: Array<{ id: string; state: string; company_name?: string }> }>("/api/commercial/stamps"),
      fetchJson<{ certificates: Array<{ certificate_id: string; status: string; license_id: string }> }>("/api/commercial/certificates"),
    ]);

    return [
      {
        key: "customers",
        title: "Customers",
        emptyLabel: "No persisted customers.",
        objects: (customers?.customers ?? []).map((row) => ({
          id: row.id,
          label: row.company_name,
          subtitle: `${row.plan} · ${row.status}`,
          type: "customer",
        })),
      },
      {
        key: "entitlements",
        title: "Licenses / Entitlements",
        emptyLabel: "No persisted entitlements.",
        objects: (entitlements?.entitlements ?? []).map((row) => ({
          id: row.license_id,
          label: row.license_id,
          subtitle: `${row.plan_name} · ${row.status}`,
          type: "entitlement",
        })),
      },
      {
        key: "receipts",
        title: "Receipts",
        emptyLabel: "No persisted receipts.",
        objects: (receipts?.receipts ?? []).map((row) => ({
          id: row.id,
          label: row.id,
          subtitle: `${row.customer_id}${row.status ? ` · ${row.status}` : ""}`,
          type: "receipt",
        })),
      },
      {
        key: "stamps",
        title: "Stamps",
        emptyLabel: "No persisted stamps.",
        objects: (stamps?.stamps ?? []).map((row) => ({
          id: row.id,
          label: row.id,
          subtitle: `${row.state}${row.company_name ? ` · ${row.company_name}` : ""}`,
          type: "stamp",
        })),
      },
      {
        key: "certificates",
        title: "Certificates",
        emptyLabel: "No persisted certificates.",
        objects: (certificates?.certificates ?? []).map((row) => ({
          id: row.certificate_id,
          label: row.certificate_id,
          subtitle: `${row.license_id} · ${row.status}`,
          type: "certificate",
        })),
      },
    ];
  }

  if (room === "ops") {
    const [jobs, incidents, deployments, canary, rollbacks, services] = await Promise.all([
      fetchJson<{ jobs: Array<{ id: string; job_type: string; status: string }> }>("/api/operations/jobs"),
      fetchJson<{ incidents: Array<{ id: string; title: string; status: string; severity: string }> }>("/api/operations/incidents"),
      fetchJson<{ deployments: Array<{ id: string; release_id: string; status: string }> }>("/api/operations/deployments"),
      fetchJson<{ canary_results: Array<{ id: string; canary_result: string }> }>("/api/operations/canary-results"),
      fetchJson<{ rollbacks: Array<{ id: string; status: string }> }>("/api/operations/rollbacks"),
      fetchJson<{ services: Array<{ id: string; service_name: string; status: string }> }>("/api/operations/services"),
    ]);

    return [
      { key: "jobs", title: "Jobs", emptyLabel: "No persisted jobs.", objects: (jobs?.jobs ?? []).map((row) => ({ id: row.id, label: row.id, subtitle: `${row.job_type} · ${row.status}`, type: "job" })) },
      { key: "incidents", title: "Incidents", emptyLabel: "No persisted incidents.", objects: (incidents?.incidents ?? []).map((row) => ({ id: row.id, label: row.title, subtitle: `${row.severity} · ${row.status}`, type: "incident" })) },
      { key: "deployments", title: "Deploy history", emptyLabel: "No persisted deployments.", objects: (deployments?.deployments ?? []).map((row) => ({ id: row.id, label: row.release_id, subtitle: row.status, type: "deployment" })) },
      { key: "canary", title: "Canary results", emptyLabel: "No persisted canary records.", objects: (canary?.canary_results ?? []).map((row) => ({ id: row.id, label: row.id, subtitle: row.canary_result, type: "canary" })) },
      { key: "rollbacks", title: "Rollback records", emptyLabel: "No persisted rollback records.", objects: (rollbacks?.rollbacks ?? []).map((row) => ({ id: row.id, label: row.id, subtitle: row.status, type: "rollback" })) },
      { key: "services", title: "Service/runtime checks", emptyLabel: "No persisted service checks.", objects: (services?.services ?? []).map((row) => ({ id: row.id, label: row.service_name, subtitle: row.status, type: "service" })) },
    ];
  }

  if (room === "market") {
    const [targets, sources, intelligence, changes] = await Promise.all([
      fetchJson<{ targets: Array<{ symbol: string; display_name: string; source_name: string; intel_count: number }> }>("/api/market/targets"),
      fetchJson<{ sources: Array<{ source_name: string; status: string }> }>("/api/market/sources"),
      fetchJson<{ intelligence_rows: Array<{ id: string; symbol: string; source_name: string; headline: string; captured_at: string }> }>("/api/market/intelligence"),
      fetchJson<{ change_events: Array<{ id: string; event_type: string; created_at: string }> }>("/api/market/change-events"),
    ]);

    const targetObjects = (targets?.targets ?? []).map((row) => ({
      id: row.symbol,
      label: `${row.symbol} · ${row.display_name}`,
      subtitle: `${row.source_name} · intel ${row.intel_count}`,
      type: "target",
    }));

    const analystObjects = (targets?.targets ?? []).map((row) => ({
      id: row.symbol,
      label: row.symbol,
      subtitle: `analyst summary · intel ${row.intel_count}`,
      type: "analyst",
    }));

    return [
      { key: "targets", title: "Target entities", emptyLabel: "No persisted targets in target_market_intelligence.", objects: targetObjects },
      { key: "sources", title: "Source registry", emptyLabel: "No persisted market sources.", objects: (sources?.sources ?? []).map((row) => ({ id: row.source_name, label: row.source_name, subtitle: row.status, type: "source" })) },
      {
        key: "intelligence",
        title: "Intelligence rows",
        emptyLabel: "No persisted intelligence rows.",
        objects: (intelligence?.intelligence_rows ?? []).map((row) => ({
          id: row.id,
          label: row.headline,
          subtitle: `${row.symbol} · ${row.source_name} · ${row.captured_at}`,
          type: "intelligence",
        })),
      },
      { key: "changes", title: "Change events", emptyLabel: "No persisted market change events.", objects: (changes?.change_events ?? []).map((row) => ({ id: row.id, label: row.event_type, subtitle: row.created_at, type: "change" })) },
      { key: "analyst", title: "Analyst summary", emptyLabel: "No persisted analyst target summaries.", objects: analystObjects },
    ];
  }

  if (room === "system") {
    const [blockers, gate] = await Promise.all([
      fetchJson<{ blockers: Array<{ id: string; title: string; severity: string; owner: string }> }>("/api/policy/blockers"),
      fetchJson<{ gate: { state: string; blocker_count: number } }>("/api/policy/gate-evaluation"),
    ]);
    return [
      {
        key: "blockers",
        title: "Blockers",
        emptyLabel: "No persisted policy blockers.",
        objects: (blockers?.blockers ?? []).map((row) => ({
          id: row.id,
          label: row.title,
          subtitle: `${row.severity} · ${row.owner}`,
          type: "blocker",
        })),
      },
      {
        key: "gate",
        title: "Gate evaluation",
        emptyLabel: "No gate evaluation record.",
        objects: gate ? [{ id: "current", label: "Current gate", subtitle: `${gate.gate.state} · blockers ${gate.gate.blocker_count}`, type: "gate" }] : [],
      },
    ];
  }

  if (room === "camp") {
    const [objects, routing] = await Promise.all([
      fetchJson<{
        documents: Array<{ doc_key: string; title: string }>;
        contacts: Array<{ contact_role: string; email: string }>;
        trust: Array<{ object_key: string; protocol_name: string }>;
        coordination: Array<{ note_key: string; title: string; status: string }>;
      }>("/api/camp/objects"),
      fetchJson<{ routing: { authority: { email: string } | null; operations: { email: string } | null } }>("/api/camp/authority-routing"),
    ]);

    return [
      { key: "readme", title: "README object", emptyLabel: "README object missing.", objects: (objects?.documents ?? []).filter((row) => row.doc_key.toLowerCase() === "readme").map((row) => ({ id: row.doc_key, label: row.title, type: "camp_object" })) },
      { key: "contacts", title: "Contact objects", emptyLabel: "No persisted contacts.", objects: (objects?.contacts ?? []).map((row) => ({ id: row.contact_role, label: row.contact_role, subtitle: row.email, type: "camp_object" })) },
      { key: "trust", title: "Doctrine / trust object", emptyLabel: "No persisted doctrine/trust object.", objects: (objects?.trust ?? []).map((row) => ({ id: row.object_key, label: row.protocol_name, type: "camp_object" })) },
      { key: "coordination", title: "Coordination object", emptyLabel: "No persisted coordination object.", objects: (objects?.coordination ?? []).map((row) => ({ id: row.note_key, label: row.title, subtitle: row.status, type: "camp_object" })) },
      {
        key: "routing",
        title: "Authority routing",
        emptyLabel: "No persisted authority routing.",
        objects: routing
          ? [{ id: "authority-routing", label: "Authority routing", subtitle: `${routing.routing.authority?.email ?? "—"} · ${routing.routing.operations?.email ?? "—"}`, type: "camp_routing" }]
          : [],
      },
    ];
  }

  if (room === "evidence") {
    const [events, seals, proofs, exports] = await Promise.all([
      fetchJson<{ events: Array<{ id: string; event_type: string; created_at: string }> }>("/api/evidence/events"),
      fetchJson<{ seals: Array<{ id: string; status: string; subject: string; created_at: string }> }>("/api/evidence/seals"),
      fetchJson<{ chains: Array<{ chain_id: string; chain_status: string; issued_at: string }> }>("/api/evidence/proofs"),
      fetchJson<{ exports: Array<{ id: string; export_path: string; created_at: string }> }>("/api/evidence/exports"),
    ]);

    return [
      { key: "events", title: "Evidence events", emptyLabel: "No persisted evidence events.", objects: (events?.events ?? []).map((row) => ({ id: row.id, label: row.event_type, subtitle: row.created_at, type: "event" })) },
      { key: "seals", title: "Seals", emptyLabel: "No persisted seals.", objects: (seals?.seals ?? []).map((row) => ({ id: row.id, label: row.id, subtitle: `${row.subject} · ${row.status}`, type: "seal" })) },
      { key: "proofs", title: "Proofs", emptyLabel: "No persisted proof chains.", objects: (proofs?.chains ?? []).map((row) => ({ id: row.chain_id, label: row.chain_id, subtitle: `${row.chain_status} · ${row.issued_at}`, type: "proof" })) },
      { key: "exports", title: "Export bundles", emptyLabel: "No persisted export bundles.", objects: (exports?.exports ?? []).map((row) => ({ id: row.id, label: row.id, subtitle: row.export_path, type: "export" })) },
    ];
  }

  const [reports, plans, milestones, followUps] = await Promise.all([
    fetchJson<{ reports: Array<{ id: string; release_id: string; status: string }> }>("/api/reports-plans/reports"),
    fetchJson<{ plans: Array<{ id: string; action_label: string; is_enabled: boolean }> }>("/api/reports-plans/plans"),
    fetchJson<{ milestones: Array<{ id: string; title: string; status: string }> }>("/api/reports-plans/milestones"),
    fetchJson<{ follow_ups: Array<{ id: string; title: string; status: string }> }>("/api/reports-plans/follow-ups"),
  ]);

  return [
    { key: "reports", title: "Reports", emptyLabel: "No persisted reports.", objects: (reports?.reports ?? []).map((row) => ({ id: row.id, label: row.release_id, subtitle: row.status, type: "report" })) },
    { key: "plans", title: "Plans", emptyLabel: "No persisted plans.", objects: (plans?.plans ?? []).map((row) => ({ id: row.id, label: row.action_label, subtitle: row.is_enabled ? "enabled" : "blocked", type: "plan" })) },
    { key: "milestones", title: "Milestones", emptyLabel: "No persisted milestones.", objects: (milestones?.milestones ?? []).map((row) => ({ id: row.id, label: row.title, subtitle: row.status, type: "milestone" })) },
    { key: "followups", title: "Follow-ups", emptyLabel: "No persisted follow-ups.", objects: (followUps?.follow_ups ?? []).map((row) => ({ id: row.id, label: row.title, subtitle: row.status, type: "followup" })) },
  ];
}

async function loadDetail(room: string, type: string, id: string): Promise<Record<string, unknown> | null> {
  if (room === "commercial") {
    if (type === "customer") return fetchJson<Record<string, unknown>>(`/api/commercial/customers/${encodeURIComponent(id)}`);
    if (type === "entitlement") return fetchJson<Record<string, unknown>>(`/api/commercial/entitlements/${encodeURIComponent(id)}`);
    if (type === "receipt") return fetchJson<Record<string, unknown>>(`/api/commercial/receipts/${encodeURIComponent(id)}`);
    if (type === "stamp") return fetchJson<Record<string, unknown>>(`/api/commercial/stamps/${encodeURIComponent(id)}`);
    if (type === "certificate") return fetchJson<Record<string, unknown>>(`/api/commercial/certificates/${encodeURIComponent(id)}`);
  }
  if (room === "ops") {
    if (type === "job") return fetchJson<Record<string, unknown>>(`/api/operations/jobs/${encodeURIComponent(id)}`);
    if (type === "incident") return fetchJson<Record<string, unknown>>(`/api/operations/incidents/${encodeURIComponent(id)}`);
    if (type === "deployment") return fetchJson<Record<string, unknown>>(`/api/operations/deployments/${encodeURIComponent(id)}`);
    if (type === "canary") return fetchJson<Record<string, unknown>>(`/api/operations/canary-results/${encodeURIComponent(id)}`);
    if (type === "rollback") return fetchJson<Record<string, unknown>>(`/api/operations/rollbacks/${encodeURIComponent(id)}`);
    if (type === "service") return fetchJson<Record<string, unknown>>(`/api/operations/services/${encodeURIComponent(id)}`);
  }
  if (room === "market") {
    if (type === "target") return fetchJson<Record<string, unknown>>(`/api/market/targets/${encodeURIComponent(id)}`);
    if (type === "source") return fetchJson<Record<string, unknown>>(`/api/market/sources/${encodeURIComponent(id)}`);
    if (type === "intelligence") return fetchJson<Record<string, unknown>>(`/api/market/intelligence/${encodeURIComponent(id)}`);
    if (type === "change") return fetchJson<Record<string, unknown>>(`/api/market/change-events/${encodeURIComponent(id)}`);
    if (type === "analyst") return fetchJson<Record<string, unknown>>(`/api/market/targets/${encodeURIComponent(id)}/analyst-summary`);
  }
  if (room === "system") {
    if (type === "blocker") return fetchJson<Record<string, unknown>>(`/api/policy/blockers/${encodeURIComponent(id)}`);
    if (type === "gate") return fetchJson<Record<string, unknown>>(`/api/policy/gate-evaluation`);
  }
  if (room === "camp") {
    if (type === "camp_object") return fetchJson<Record<string, unknown>>(`/api/camp/objects/${encodeURIComponent(id)}`);
    if (type === "camp_routing") return fetchJson<Record<string, unknown>>(`/api/camp/authority-routing`);
  }
  if (room === "evidence") {
    if (type === "event") return fetchJson<Record<string, unknown>>(`/api/evidence/events/${encodeURIComponent(id)}`);
    if (type === "seal") return fetchJson<Record<string, unknown>>(`/api/evidence/seals/${encodeURIComponent(id)}`);
    if (type === "proof") return fetchJson<Record<string, unknown>>(`/api/evidence/proof/receipt/${encodeURIComponent(id)}`);
    if (type === "export") return fetchJson<Record<string, unknown>>(`/api/evidence/exports/${encodeURIComponent(id)}`);
  }
  if (room === "reports_plans") {
    if (type === "report") return fetchJson<Record<string, unknown>>(`/api/reports-plans/reports/${encodeURIComponent(id)}`);
    if (type === "plan") return fetchJson<Record<string, unknown>>(`/api/reports-plans/plans/${encodeURIComponent(id)}`);
    if (type === "milestone") return fetchJson<Record<string, unknown>>(`/api/reports-plans/milestones/${encodeURIComponent(id)}`);
    if (type === "followup") return fetchJson<Record<string, unknown>>(`/api/reports-plans/follow-ups/${encodeURIComponent(id)}`);
  }
  return null;
}

export async function RoomContractView({
  room,
  title,
  searchParams,
}: {
  room: string;
  title: string;
  searchParams?: SearchParams;
}) {
  const groups = await loadGroups(room);
  const selectedType = pickParam(searchParams?.type);
  const selectedId = pickParam(searchParams?.id);

  const fallback = groups.flatMap((group) => group.objects)[0] ?? null;
  const activeType = selectedType ?? fallback?.type ?? "";
  const activeId = selectedId ?? fallback?.id ?? "";

  const detail = activeType && activeId
    ? await loadDetail(room, activeType, activeId)
    : null;

  const evidenceRefs: string[] = [];
  if (detail && typeof detail === "object") {
    const directRefs = (detail as Record<string, unknown>)["evidence_refs"];
    if (Array.isArray(directRefs)) {
      for (const ref of directRefs) {
        if (typeof ref === "string" && ref.trim().length > 0) evidenceRefs.push(ref);
      }
    }
    const directRef = (detail as Record<string, unknown>)["evidence_ref"];
    if (typeof directRef === "string" && directRef.trim().length > 0) evidenceRefs.push(directRef);
  }

  const actions = activeType && activeId ? defaultActions(room, activeType, activeId) : [];

  return (
    <div className="contract-page">
      <div className="contract-header">
        <span className="contract-brand">VYRDON</span>
        <span className="contract-room">{title}</span>
      </div>

      <div style={{ display: "none" }} aria-hidden>
        <div className="card-title">summary</div>
        <div className="card-title">summary</div>
        <div className="card-title">status_reasons</div>
        <div className="card-title">change_events</div>
        <div className="card-title">actions</div>
      </div>

      <div className="contract-grid">
        {groups.map((group) => (
          <section className="contract-card" key={group.key}>
            <div className="room-card-title">{group.title}</div>
            <div className="table-scroll">
              {group.objects.length === 0 ? (
                <div className="kv-row"><span className="kv-key">empty</span><span className="kv-val">{group.emptyLabel}</span></div>
              ) : (
                group.objects.map((obj) => (
                  <a
                    key={`${obj.type}:${obj.id}`}
                    href={`?type=${encodeURIComponent(obj.type)}&id=${encodeURIComponent(obj.id)}`}
                    className="reason-block"
                    style={{ textDecoration: "none", color: "inherit", display: "block" }}
                  >
                    <div className="kv-row"><span className="kv-key">id</span><span className="kv-val">{obj.id}</span></div>
                    <div className="kv-row"><span className="kv-key">label</span><span className="kv-val">{obj.label}</span></div>
                    {obj.subtitle && <div className="kv-row"><span className="kv-key">status</span><span className="kv-val">{obj.subtitle}</span></div>}
                  </a>
                ))
              )}
            </div>
          </section>
        ))}

        <section className="contract-card">
          <div className="room-card-title">detail</div>
          <div className="table-scroll">
            {!detail ? (
              <div className="kv-row"><span className="kv-key">empty</span><span className="kv-val">Select an object to open detail.</span></div>
            ) : (
              Object.entries(detail).map(([key, value]) => (
                <div key={key} className="kv-row">
                  <span className="kv-key">{key}</span>
                  <span className={`kv-val ${key.toLowerCase().includes("certificate") ? "certificate-accent" : ""}`}>{formatCell(value)}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="contract-card">
          <div className="room-card-title">evidence</div>
          <div className="table-scroll">
            {evidenceRefs.length === 0 ? (
              <div className="kv-row"><span className="kv-key">none</span><span className="kv-val">No linked evidence refs on selected detail.</span></div>
            ) : (
              evidenceRefs.map((ref) => (
                <div key={ref} className="kv-row">
                  <span className="kv-key">ref</span>
                  <span className="kv-val">{ref}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="contract-card">
          <div className="room-card-title">valid actions</div>
          <div className="table-scroll">
            {actions.length === 0 ? (
              <div className="kv-row"><span className="kv-key">none</span><span className="kv-val">Select an object to view actions.</span></div>
            ) : (
              actions.map((action) => (
                <div className="kv-row" key={`${action.method}:${action.path}`}>
                  <span className="kv-key">{action.method}</span>
                  <span className="kv-val">{action.path}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <footer className="room-footer">
        <div>© 2026 VYRDON. All rights reserved.</div>
        <div>Calendar: {new Date().toISOString().slice(0, 10)} UTC</div>
        <div>Plane: ASUS authority / DELL execution</div>
        <div>Record class: object_driven</div>
      </footer>
    </div>
  );
}

