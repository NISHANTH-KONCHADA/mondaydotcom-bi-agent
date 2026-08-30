import { fetchAllBoardItems, flattenItem } from '../monday/client.js';
import { normalizeWorkOrders } from '../normalization/workorders.js';
import * as cache from '../cache.js';

const BOARD_ID = process.env.MONDAY_WORK_ORDERS_BOARD_ID;
const CACHE_KEY = 'work_orders_normalized';

async function loadWorkOrders() {
  const cached = cache.get(CACHE_KEY);
  if (cached) return cached;

  const { columns, items } = await fetchAllBoardItems(BOARD_ID);
  const flatItems = items.map(item => flattenItem(item, columns));
  const result = normalizeWorkOrders(flatItems);
  cache.set(CACHE_KEY, result);
  return result;
}

function isDateInRange(dateStr, from, to) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (from && d < new Date(from)) return false;
  if (to && d > new Date(to)) return false;
  return true;
}

function matchesFilter(wo, filters) {
  const f = filters || {};

  if (f.sector?.length) {
    if (!wo.sector) return false;
    const s = wo.sector.toLowerCase();
    if (!f.sector.some(sec => s.includes(sec.toLowerCase()))) return false;
  }
  if (f.execution_status?.length) {
    if (!wo.executionStatus) return false;
    if (!f.execution_status.some(es => wo.executionStatus.toLowerCase().includes(es.toLowerCase()))) return false;
  }
  if (f.billing_status?.length) {
    if (!wo.billingStatus) return false;
    if (!f.billing_status.some(bs => wo.billingStatus.toLowerCase().includes(bs.toLowerCase()))) return false;
  }
  if (f.wo_status?.length) {
    if (!wo.woStatus) return false;
    if (!f.wo_status.some(ws => wo.woStatus.toLowerCase() === ws.toLowerCase())) return false;
  }
  if (f.owner?.length) {
    if (!wo.ownerCode) return false;
    if (!f.owner.some(o => wo.ownerCode.toLowerCase() === o.toLowerCase())) return false;
  }
  if (f.natureOfWork?.length) {
    if (!wo.natureOfWork) return false;
    const n = wo.natureOfWork.toLowerCase();
    if (!f.natureOfWork.some(now => n.includes(now.toLowerCase()))) return false;
  }
  if (f.startDateFrom || f.startDateTo) {
    if (!isDateInRange(wo.probableStartDate, f.startDateFrom, f.startDateTo)) return false;
  }
  if (f.startDate) { // backward compat
    if (!isDateInRange(wo.probableStartDate, f.startDate?.from, f.startDate?.to)) return false;
  }
  if (f.hasAnomaly === true && !wo.isNegativeBilling) return false;
  if (f.arPriorityOnly === true && !wo.arPriority) return false;

  return true;
}

export const getWorkOrdersToolDef = {
  type: 'function',
  function: {
    name: 'get_work_orders',
    description: `Fetch normalized work orders from the Work Orders board. Apply optional filters.
Returns a data_quality block with anomaly flags (negative billing amounts) and normalization notes.
Note: WO Status (Open/Closed) tracks billing lifecycle; Execution Status tracks field work lifecycle — these are DIFFERENT.`,
    parameters: {
      type: 'object',
      properties: {
        sector: {
          type: 'array', items: { type: 'string' },
          description: 'Filter by sector (Mining, Powerline, Renewables, Railways, DSP, Construction, Others). Case-insensitive.',
        },
        execution_status: {
          type: 'array', items: { type: 'string' },
          description: 'Filter by Execution Status: "Completed", "Ongoing", "Not Started", "Executed until current month", "Details pending from Client".',
        },
        billing_status: {
          type: 'array', items: { type: 'string' },
          description: 'Filter by normalized Billing Status: "Fully Billed", "Partially Billed", "Billed", "Not Billed Yet", "Update Required".',
        },
        wo_status: {
          type: 'array', items: { type: 'string' },
          description: 'Filter by WO Status (billing lifecycle): "Open", "Closed".',
        },
        owner: {
          type: 'array', items: { type: 'string' },
          description: 'Filter by BD/KAM Personnel code (OWNER_001, OWNER_002, etc.).',
        },
        natureOfWork: {
          type: 'array', items: { type: 'string' },
          description: 'Filter by Nature of Work (One time Project, Monthly Contract, Annual Rate Contract, Proof of Concept).',
        },
        startDateFrom: {
          type: 'string',
          description: 'Filter Probable Start Date >= this ISO date (YYYY-MM-DD).',
        },
        startDateTo: {
          type: 'string',
          description: 'Filter Probable Start Date <= this ISO date (YYYY-MM-DD).',
        },
        hasAnomaly: {
          type: 'boolean',
          description: 'If true, return only work orders with negative "Amount to be billed" (over-billing anomaly).',
        },
        arPriorityOnly: {
          type: 'boolean',
          description: 'If true, return only AR Priority accounts.',
        },
      },
    },
  },
};

export async function getWorkOrders(filters) {
  try {
    const { workOrders, data_quality } = await loadWorkOrders();
    const filtered = workOrders.filter(wo => matchesFilter(wo, filters));

    const withAmount = filtered.filter(w => w.amountExclGST !== null).length;
    const anomalies = filtered.filter(w => w.isNegativeBilling);
    const qualitySlice = {
      ...data_quality,
      rows_returned: filtered.length,
      with_amount_count: withAmount,
      coverage_note: filtered.length > 0
        ? `Contract value populated for ${withAmount} of ${filtered.length} matching work orders. ` +
          (filtered.length < workOrders.length ? `(${filtered.length} of ${workOrders.length} total match your filters.)` : '')
        : 'No matching work orders.',
      anomalies: anomalies.length > 0
        ? [`${anomalies.length} work order(s) with negative billing amount (over-billing vs PO): ${anomalies.map(w => w.serialNo || w.dealName).join(', ')}`]
        : [],
    };

    return { rows: filtered, data_quality: qualitySlice };
  } catch (err) {
    return { rows: [], data_quality: { error: err.message }, error: err.message };
  }
}
