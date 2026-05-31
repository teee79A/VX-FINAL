import type { FastifyInstance } from "fastify";
import { query, queryOne } from "../db.js";
import { withRateLimit } from "../lib/rate-limit.js";

export async function registerCampRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/camp/objects", withRateLimit(async () => {
    const [documents, contacts, identity, coordinationNotes] = await Promise.all([
      query<{
        doc_key: string;
        title: string;
        body: string;
        updated_at: string;
      }>(
        `SELECT doc_key,
                title,
                body,
                updated_at::text AS updated_at
           FROM camp_documents
          ORDER BY doc_key ASC`,
      ),
      query<{
        contact_role: string;
        email: string;
        updated_at: string;
      }>(
        `SELECT contact_role,
                email,
                updated_at::text AS updated_at
           FROM camp_contacts
          ORDER BY contact_role ASC`,
      ),
      queryOne<{
        protocol_name: string;
        system_name: string;
        execution_model: string;
        seal_policy: string;
        updated_at: string;
      }>(
        `SELECT protocol_name,
                system_name,
                execution_model,
                seal_policy,
                updated_at::text AS updated_at
           FROM camp_identity
          ORDER BY updated_at DESC
          LIMIT 1`,
      ),
      query<{
        note_key: string;
        title: string;
        body: string;
        status: string;
        starts_at: string | null;
        updated_at: string;
      }>(
        `SELECT note_key,
                title,
                body,
                status,
                starts_at::text AS starts_at,
                updated_at::text AS updated_at
           FROM camp_coordination_notes
          ORDER BY updated_at DESC`,
      ),
    ]);

    return {
      source: "primary_db",
      documents,
      contacts,
      trust: identity
        ? [{
            object_key: "trust_authority",
            protocol_name: identity.protocol_name,
            system_name: identity.system_name,
            execution_model: identity.execution_model,
            seal_policy: identity.seal_policy,
            updated_at: identity.updated_at,
          }]
        : [],
      coordination: coordinationNotes,
    };
  }));

  server.get<{ Params: { objectKey: string } }>("/api/camp/objects/:objectKey", withRateLimit<{ Params: { objectKey: string } }>(async (req, reply) => {
    const objectKey = req.params.objectKey.trim().toLowerCase();
    if (!objectKey) {
      return reply.code(400).send({ error: "object_key_required" });
    }

    if (objectKey === "trust_authority") {
      const identity = await queryOne<{
        protocol_name: string;
        system_name: string;
        execution_model: string;
        seal_policy: string;
        updated_at: string;
      }>(
        `SELECT protocol_name,
                system_name,
                execution_model,
                seal_policy,
                updated_at::text AS updated_at
           FROM camp_identity
          ORDER BY updated_at DESC
          LIMIT 1`,
      );
      if (!identity) return reply.code(404).send({ error: "object_not_found" });
      return {
        object: {
          object_key: "trust_authority",
          protocol_name: identity.protocol_name,
          system_name: identity.system_name,
          execution_model: identity.execution_model,
          seal_policy: identity.seal_policy,
          updated_at: identity.updated_at,
        },
      };
    }

    const document = await queryOne<{
      doc_key: string;
      title: string;
      body: string;
      updated_at: string;
    }>(
      `SELECT doc_key,
              title,
              body,
              updated_at::text AS updated_at
         FROM camp_documents
        WHERE doc_key = $1
        LIMIT 1`,
      [objectKey],
    );

    if (document) {
      return { object: document };
    }

    const coordination = await queryOne<{
      note_key: string;
      title: string;
      body: string;
      status: string;
      starts_at: string | null;
      updated_at: string;
    }>(
      `SELECT note_key,
              title,
              body,
              status,
              starts_at::text AS starts_at,
              updated_at::text AS updated_at
         FROM camp_coordination_notes
        WHERE note_key = $1
        LIMIT 1`,
      [objectKey],
    );
    if (coordination) {
      return { object: coordination };
    }

    const contact = await queryOne<{
      contact_role: string;
      email: string;
      updated_at: string;
    }>(
      `SELECT contact_role,
              email,
              updated_at::text AS updated_at
         FROM camp_contacts
        WHERE contact_role = $1
        LIMIT 1`,
      [objectKey],
    );
    if (contact) {
      return { object: contact };
    }

    return reply.code(404).send({ error: "object_not_found" });
  }));

  server.get("/api/camp/authority-routing", withRateLimit(async () => {
    const contacts = await query<{
      contact_role: string;
      email: string;
      updated_at: string;
    }>(`
      SELECT contact_role,
             email,
             updated_at::text AS updated_at
      FROM camp_contacts
      ORDER BY contact_role ASC
    `);

    const identity = await queryOne<{
      protocol_name: string;
      system_name: string;
      execution_model: string;
      updated_at: string;
    }>(`
      SELECT protocol_name,
             system_name,
             execution_model,
             updated_at::text AS updated_at
      FROM camp_identity
      ORDER BY updated_at DESC
      LIMIT 1
    `);

    return {
      routing: {
        authority: contacts.find((entry) => entry.contact_role.toLowerCase() === "authority") ?? null,
        operations: contacts.find((entry) => {
          const role = entry.contact_role.toLowerCase();
          return role === "operations" || role === "ops";
        }) ?? null,
        protocol: identity,
      },
      actions: ["route_authority", "route_operations"],
    };
  }));
}
