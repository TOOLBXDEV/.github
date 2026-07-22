#!/usr/bin/env node
/**
 * Applies company lifecycle workflow changes (portal automation v4 PUT).
 * Requires HUBSPOT_ACCESS_TOKEN with automation scope in .env.local (repo root or cwd).
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadToken() {
  for (const p of [
    join(__dirname, "../.env.local"),
    join(process.cwd(), ".env.local"),
  ]) {
    try {
      const m = readFileSync(p, "utf8").match(/HUBSPOT_ACCESS_TOKEN=(.+)/);
      if (m) return m[1].trim();
    } catch {
      /* continue */
    }
  }
  throw new Error("HUBSPOT_ACCESS_TOKEN not found in .env.local");
}

const TOKEN = loadToken();
const BASE = "https://api.hubapi.com/automation/v4/flows";

async function getFlow(id) {
  const r = await fetch(`${BASE}/${id}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!r.ok) throw new Error(`GET ${id} ${r.status} ${await r.text()}`);
  return r.json();
}

function stripForPut(flow) {
  const o = { ...flow };
  delete o.createdAt;
  delete o.updatedAt;
  delete o.dataSources;
  delete o.uuid;
  return o;
}

async function putFlow(flow) {
  const id = flow.id;
  const body = stripForPut(flow);
  const r = await fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`PUT ${id} ${r.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

// Stages allowed to move to Closed Lost – Re-engage (exclude post-sale / customer)
const CL_REENGAGE_FROM_STAGES = [
  "subscriber",
  "lead",
  "marketingqualifiedlead",
  "salesqualifiedlead",
  "opportunity",
  "other",
  "1020959500",
  "1324949332",
];

const SKIP_OPPORTUNITY_STAGES = ["customer", "1050035315", "1050035316"];

async function main() {
  console.log("--- 1) Auto-entry 1792351752: expand company lifecycle filter ---");
  const wf1 = await getFlow("1792351752");
  const ref = wf1.enrollmentCriteria.refinementCriteria;
  const assocBranch = ref.filterBranches[0].filterBranches[0];
  const lifeFilter = assocBranch.filters.find((f) => f.property === "lifecyclestage");
  if (!lifeFilter) throw new Error("lifecycle filter not found");
  lifeFilter.operation.operator = "IS_ANY_OF";
  lifeFilter.operation.values = CL_REENGAGE_FROM_STAGES;
  lifeFilter.operation.includeObjectsWithNoValueSet = false;
  await putFlow(wf1);
  console.log("OK revision", wf1.revisionId, "-> updated");

  console.log("\n--- 2) Auto-exit 1792375197: any non-customer/post-sale -> Opportunity on deal create ---");
  const wf2 = await getFlow("1792375197");
  const ref2 = wf2.enrollmentCriteria.refinementCriteria;
  const assoc2 = ref2.filterBranches[0].filterBranches[0];
  const lf2 = assoc2.filters.find((f) => f.property === "lifecyclestage");
  lf2.operation = {
    operator: "IS_NONE_OF",
    includeObjectsWithNoValueSet: true,
    values: SKIP_OPPORTUNITY_STAGES,
    operationType: "ENUMERATION",
  };
  await putFlow(wf2);
  console.log("OK");

  console.log("\n--- 3) Closed Won 1640563895: company lifecycle -> customer (per lifecycle table) ---");
  const wf3 = await getFlow("1640563895");
  const act2 = wf3.actions.find((a) => a.actionId === "2");
  if (!act2?.fields?.value) throw new Error("action 2 not found");
  act2.fields.value.staticValue = "customer";
  await putFlow(wf3);
  console.log("OK");

  console.log("\n--- 4) Meeting deal creation 1795728484: set company Opportunity after create ---");
  const wf4 = await getFlow("1795728484");
  wf4.startActionId = "1";
  wf4.nextAvailableActionId = "3";
  const createDeal = wf4.actions.find((a) => a.actionId === "1");
  createDeal.connection = { edgeType: "STANDARD", nextActionId: "2" };
  wf4.actions.push({
    actionId: "2",
    actionTypeVersion: 0,
    actionTypeId: "0-5",
    fields: {
      property_name: "lifecyclestage",
      association: {
        associationCategory: "HUBSPOT_DEFINED",
        associationTypeId: 188,
      },
      value: { staticValue: "opportunity", type: "STATIC_VALUE" },
    },
    type: "SINGLE_CONNECTION",
  });
  await putFlow(wf4);
  console.log("OK");

  console.log(`
--- Lead on company create (manual / Settings) ---
HubSpot property companies/lifecyclestage is hubspot-defined; API cannot set defaultValue.
In HubSpot: Settings → Data management → Objects → Companies → Lifecycle stages,
or create a Company workflow: trigger "Company record is created" → if lifecycle is empty → set Lead.
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
