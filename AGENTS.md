# Project architecture rules

- Keep mobile operational data access on security-invoker projection views and use an Administrator-only security-invoker seed for controlled acceptance data; this preserves caller RLS and prevents commercial-data exposure.
