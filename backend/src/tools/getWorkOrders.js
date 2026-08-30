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

function matchesFilter(wo, filters = {}) {
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
  if (f.startDate) {
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
    description: `Fetch normalized work orders from the Work Orders board.
Pass a JSON filters object as the "filters" string parameter.
Available filter keys (all optional):
- sector: array of strings (Mining, Powerline, Renewables, Railways, DSP, Construction, Others)
- execution_status: array of strings (Completed, Ongoing, "Not Started", "Executed until current month")
- billing_status: array of strings ("Fully Billed", "Partially Billed", Billed, "Not Billed Yet", "Update Required")
- wo_status: array of strings (Open, Closed) — BILLING lifecycle
- owner: array of strings (e.g. ["OWNER_001"])
- hasAnomaly: boolean (true = only negative "amount to be billed" rows)
- arPriorityOnly: boolean (true = only AR priority accounts)
Example: {"sector":["Mining"],"wo_status":["Open"]}
Returns summary stats, breakdowns (execution, billing, sector, owner), financial totals, and anomalies.`,
    parameters: {
      type: 'object',
      properties: {
        filters: {
          type: 'string',
          description: 'JSON string of filter options. Use "{}" to get all work orders.',
        },
      },
    },
  },
};

export async function getWorkOrders(filters = {}) {
  try {
    const { workOrders, data_quality } = await loadWorkOrders();
    const filtered = workOrders.filter(wo => matchesFilter(wo, filters));

    const withAmount = filtered.filter(w => w.amountExclGST !== null).length;
    const totalAmount = filtered.reduce((s, w) => s + (w.amountExclGST || 0), 0);
    const totalBilled = filtered.reduce((s, w) => s + (w.billedValueExclGST || 0), 0);
    const totalCollected = filtered.reduce((s, w) => s + (w.collectedAmount || 0), 0);
    const totalReceivable = filtered.reduce((s, w) => s + (w.amountReceivable || 0), 0);
    const anomalies = filtered.filter(w => w.isNegativeBilling);
    const arPriorityList = filtered.filter(w => Boolean(w.arPriority));

    // Pre-aggregate breakdowns
    const byExecutionStatus = {}, byBillingStatus = {}, byWOStatus = {}, bySector = {}, byOwner = {};
    for (const w of filtered) {
      const es = w.executionStatus || 'Unknown';
      byExecutionStatus[es] = (byExecutionStatus[es] || { count: 0, amount: 0 });
      byExecutionStatus[es].count++;
      byExecutionStatus[es].amount += (w.amountExclGST || 0);

      const bs = w.billingStatus || 'Unknown';
      byBillingStatus[bs] = (byBillingStatus[bs] || { count: 0, amount: 0, receivable: 0 });
      byBillingStatus[bs].count++;
      byBillingStatus[bs].amount += (w.amountExclGST || 0);
      byBillingStatus[bs].receivable += (w.amountReceivable || 0);

      const ws = w.woStatus || 'Unknown';
      byWOStatus[ws] = (byWOStatus[ws] || { count: 0, amount: 0 });
      byWOStatus[ws].count++;
      byWOStatus[ws].amount += (w.amountExclGST || 0);

      const sec = w.sector || 'Unknown';
      bySector[sec] = (bySector[sec] || { count: 0, amount: 0 });
      bySector[sec].count++;
      bySector[sec].amount += (w.amountExclGST || 0);

      const own = w.ownerCode || 'Unknown';
      byOwner[own] = (byOwner[own] || { count: 0, amount: 0 });
      byOwner[own].count++;
      byOwner[own].amount += (w.amountExclGST || 0);
    }

    const anomalyDetails = anomalies.slice(0, 10).map(w => ({
      serialNo: w.serialNo,
      dealName: w.dealName,
      customerCode: w.customerCode,
      amountToBeBilledExcl: w.amountToBeBilledExcl,
      amountExclGST: w.amountExclGST,
      billedValueExclGST: w.billedValueExclGST,
      note: 'Negative amount to be billed indicates over-billing vs PO (anomaly)'
    }));

    return {
      summary: {
        total_matched: filtered.length,
        total_in_board: data_quality.total_rows,
        with_amount: withAmount,
        total_contract_value_inr: Math.round(totalAmount),
        total_contract_value_cr: parseFloat((totalAmount / 10000000).toFixed(2)),
        total_billed_value_cr: parseFloat((totalBilled / 10000000).toFixed(2)),
        total_collected_cr: parseFloat((totalCollected / 10000000).toFixed(2)),
        total_receivable_cr: parseFloat((totalReceivable / 10000000).toFixed(2)),
        ar_priority_accounts_count: arPriorityList.length,
        anomalies_negative_billing_count: anomalies.length,
      },
      data_quality: {
        coverage_note: `Contract amount populated for ${withAmount} of ${filtered.length} work orders.`,
        normalizations: data_quality.normalizations || [],
        anomalies: anomalies.length > 0
          ? [`[Anomaly Alert] ${anomalies.length} work order(s) with negative billing amount (over-billed vs PO).`]
          : [],
      },
      breakdowns: {
        by_execution_status: byExecutionStatus,
        by_billing_status: byBillingStatus,
        by_wo_status: byWOStatus,
        by_sector: bySector,
        by_owner: byOwner,
      },
      anomalies: anomalyDetails,
      ar_priority_samples: arPriorityList.slice(0, 5).map(w => ({
        serialNo: w.serialNo,
        dealName: w.dealName,
        customerCode: w.customerCode,
        amountReceivable: w.amountReceivable,
      })),
    };
  } catch (err) {
    return { error: err.message };
  }
}
