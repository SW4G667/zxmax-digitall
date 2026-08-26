export type SecurityEventType = "auth.login" | "auth.recovery" | "auth.discord" | "admin.access";
export type SecurityEventOutcome = "success" | "failure" | "blocked";

type FunctionClient = {
  functions: { invoke: (name: string, options: { body: { eventType: SecurityEventType; outcome: SecurityEventOutcome } }) => unknown };
};

/** Registra apenas tipo e resultado; e-mail, senha e tokens nunca atravessam este contrato. */
export function recordSecurityEvent(client: FunctionClient, eventType: SecurityEventType, outcome: SecurityEventOutcome) {
  return client.functions.invoke("security-event", { body: { eventType, outcome } });
}
