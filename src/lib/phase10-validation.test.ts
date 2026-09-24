import { describe, expect, it } from "vitest";

const editable: Record<string, string[]> = {
  external_share_snapshots: ["external_party_id", "source_entity_type", "source_entity_id", "share_mode", "permission", "recipient_email", "expires_at", "manifest", "checksum"],
  external_api_clients: ["external_party_id", "client_name", "scopes", "active"],
  external_webhook_subscriptions: ["external_party_id", "endpoint_url", "event_types", "active"],
};
function sanitize(table: keyof typeof editable, payload: Record<string, unknown>) { return Object.fromEntries(Object.entries(payload).filter(([key]) => editable[table].includes(key))); }

describe("Phase 10 mutation boundaries", () => {
  it("does not permit a client to set frozen-share revocation attribution", () => {
    expect(sanitize("external_share_snapshots", { revoked_by: "other-user", revoked_at: "now", checksum: "safe", manifest: [] })).toEqual({ checksum: "safe", manifest: [] });
  });
  it("does not allow raw integration secrets through generic record writes", () => {
    expect(sanitize("external_api_clients", { client_secret_hash: "secret", client_key_hint: "hint", client_name: "Partner API" })).toEqual({ client_name: "Partner API" });
    expect(sanitize("external_webhook_subscriptions", { signing_secret_hash: "secret", signing_secret_hint: "hint", endpoint_url: "https://partner.example/hook" })).toEqual({ endpoint_url: "https://partner.example/hook" });
  });
});
