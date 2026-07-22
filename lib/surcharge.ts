/** Parsed surcharging from bi_ecommerce_config JSON or HubSpot company booleans. */
export interface SurchargeInfo {
  orders_enabled: boolean | null;
  payments_enabled: boolean | null;
  orders_rate_pct: number | null;
  payments_rate_pct: number | null;
  source: "platform" | "hubspot" | null;
}

type SurchargeSlot = {
  isEnabled?: boolean;
  percentSurcharge?: number;
};

function slotEnabled(slot: SurchargeSlot | undefined): boolean | null {
  if (!slot || typeof slot.isEnabled !== "boolean") return null;
  return slot.isEnabled;
}

function slotRatePct(slot: SurchargeSlot | undefined): number | null {
  if (!slot || typeof slot.percentSurcharge !== "number") return null;
  return Math.round(slot.percentSurcharge * 10000) / 100;
}

function parsePlatformJson(raw: unknown): SurchargeInfo | null {
  if (raw == null || raw === "" || raw === "null") return null;
  let obj: Record<string, unknown>;
  try {
    obj = typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, unknown>);
  } catch {
    return null;
  }
  const orders = obj.orders as Record<string, SurchargeSlot> | undefined;
  const payments = obj.payments as Record<string, SurchargeSlot> | undefined;
  const orderSlot = orders?.default ?? orders?.debit;
  const paySlot = payments?.default ?? payments?.debit;
  const orders_enabled = slotEnabled(orderSlot);
  const payments_enabled = slotEnabled(paySlot);
  if (orders_enabled === null && payments_enabled === null) return null;
  return {
    orders_enabled,
    payments_enabled,
    orders_rate_pct: slotRatePct(orderSlot),
    payments_rate_pct: slotRatePct(paySlot),
    source: "platform",
  };
}

function hubspotBool(raw: unknown): boolean | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim().toLowerCase();
  if (s === "true" || s === "yes") return true;
  if (s === "false" || s === "no") return false;
  return null;
}

/** Platform config wins when present; otherwise HubSpot order/payment flags. */
export function resolveSurcharge(
  platformConfig: unknown,
  hsOrdersEnabled: unknown,
  hsPaymentsEnabled: unknown,
): SurchargeInfo {
  const platform = parsePlatformJson(platformConfig);
  if (platform) return platform;

  const orders_enabled = hubspotBool(hsOrdersEnabled);
  const payments_enabled = hubspotBool(hsPaymentsEnabled);
  if (orders_enabled === null && payments_enabled === null) {
    return {
      orders_enabled: null,
      payments_enabled: null,
      orders_rate_pct: null,
      payments_rate_pct: null,
      source: null,
    };
  }
  return {
    orders_enabled,
    payments_enabled,
    orders_rate_pct: null,
    payments_rate_pct: null,
    source: "hubspot",
  };
}

export function formatSurchargeSummary(info: SurchargeInfo): string {
  if (info.source === null) return "Unknown (no platform or HubSpot surcharge data)";

  const part = (label: string, on: boolean | null, pct: number | null) => {
    if (on === null) return `${label}: —`;
    if (!on) return `${label}: No`;
    return pct != null ? `${label}: Yes (${pct}%)` : `${label}: Yes`;
  };

  const src =
    info.source === "platform"
      ? "TOOLBX platform config"
      : "HubSpot company fields";
  return `${part("Orders", info.orders_enabled, info.orders_rate_pct)} · ${part("Payments", info.payments_enabled, info.payments_rate_pct)} (${src})`;
}
