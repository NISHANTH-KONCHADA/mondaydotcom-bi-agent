import { fetchAllBoardItems, flattenItem } from '../monday/client.js';
import { normalizeDeals } from '../normalization/deals.js';
import * as cache from '../cache.js';

const BOARD_ID = process.env.MONDAY_DEALS_BOARD_ID;
const CACHE_KEY = 'deals_normalized';

async function loadDeals() {
  const cached = cache.get(CACHE_KEY);
  if (cached) return cached;
  const { columns, items } = await fetchAllBoardItems(BOARD_ID);
  const flatItems = items.map(item => flattenItem(item, columns));
  const result = normalizeDeals(flatItems);
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

function matchesFilter(deal, f = {}) {
  if (f.sector?.length) {
    if (!deal.sector) return false;
    if (!f.sector.some(s => deal.sector.toLowerCase().includes(s.toLowerCase()))) return false;
  }
  if (f.status?.length) {
    if (!deal.dealStatus) return false;
    if (!f.status.some(s => deal.dealStatus.toLowerCase() === s.toLowerCase())) return false;
  }
  if (f.stage?.length) {
    if (!deal.dealStage) return false;
    if (!f.stage.some(s => deal.dealStage.toLowerCase().includes(s.toLowerCase()))) return false;
  }
  if (f.owner?.length) {
    if (!deal.ownerCode) return false;
    if (!f.owner.some(o => deal.ownerCode.toLowerCase() === o.toLowerCase())) return false;
  }
  if (f.closeDateFrom || f.closeDateTo) {
    if (!isDateInRange(deal.tentativeCloseDate, f.closeDateFrom, f.closeDateTo)) return false;
  }
  if (f.hasValue === true && deal.dealValue === null) return false;
  if (f.hasValue === false && deal.dealValue !== null) return false;
  return true;
}

export const getDealsToolDef = {
  type: 'function',
  function: {
    name: 'get_deals',
    description: `Fetch normalized deals from the Deals Pipeline board.
Pass a JSON filters object as the "filters" string parameter.
Available filter keys (all optional — omit keys you don't need):
- sector: array of strings (Mining, Powerline, Renewables, Railways, DSP, Tender, Others, Construction)
- status: array of strings (Open, Won, Dead, "On Hold")
- stage: array of strings (partial match, e.g. "Won", "Proposal", "Negotiations")
- owner: array of strings (e.g. ["OWNER_001"])
- closeDateFrom: string YYYY-MM-DD (Tentative Close Date >=)
- closeDateTo: string YYYY-MM-DD (Tentative Close Date <=)
- hasValue: boolean (true = only deals with deal value populated)
Example: {"sector":["Mining"],"status":["Open"]}
Returns summary stats + sector/stage/status breakdowns + top deals list.`,
    parameters: {
      type: 'object',
      properties: {
        filters: {
          type: 'string',
          description: 'JSON string of filter options. Use "{}" to get all deals.',
        },
      },
    },
  },
};

export async function getDeals(filters = {}) {
  try {
    const { deals, data_quality } = await loadDeals();
    const filtered = deals.filter(d => matchesFilter(d, filters));

    const withValue = filtered.filter(d => d.dealValue !== null).length;
    const totalValue = filtered.reduce((s, d) => s + (d.dealValue || 0), 0);

    // Pre-aggregate breakdowns so model doesn't need to call aggregate separately
    const byStatus = {}, bySector = {}, byStage = {}, byOwner = {};
    for (const d of filtered) {
      const st = d.dealStatus || 'Unknown';
      byStatus[st] = (byStatus[st] || { count: 0, value: 0 });
      byStatus[st].count++; byStatus[st].value += (d.dealValue || 0);

      const sec = d.sector || 'Unknown';
      bySector[sec] = (bySector[sec] || { count: 0, value: 0 });
      bySector[sec].count++; bySector[sec].value += (d.dealValue || 0);

      const stg = (d.dealStage || 'Unknown').substring(0, 30);
      byStage[stg] = (byStage[stg] || { count: 0, value: 0 });
      byStage[stg].count++; byStage[stg].value += (d.dealValue || 0);

      const own = d.ownerCode || 'Unknown';
      byOwner[own] = (byOwner[own] || { count: 0, value: 0 });
      byOwner[own].count++; byOwner[own].value += (d.dealValue || 0);
    }

    // Top 10 deals by value for drill-down
    const topDeals = filtered
      .filter(d => d.dealValue !== null)
      .sort((a, b) => b.dealValue - a.dealValue)
      .slice(0, 10)
      .map(d => ({
        dealName: d.dealName, sector: d.sector, status: d.dealStatus,
        stage: d.dealStage, owner: d.ownerCode, value: d.dealValue,
        tentativeClose: d.tentativeCloseDate,
      }));

    // At-risk: open deals with overdue tentative close date
    const today = new Date().toISOString().split('T')[0];
    const atRisk = filtered.filter(d =>
      d.dealStatus === 'Open' && d.tentativeCloseDate && d.tentativeCloseDate < today
    ).length;

    return {
      summary: {
        total_matched: filtered.length,
        total_in_board: data_quality.total_rows,
        with_value: withValue,
        without_value: filtered.length - withValue,
        total_pipeline_value_inr: Math.round(totalValue),
        total_pipeline_value_cr: parseFloat((totalValue / 10000000).toFixed(2)),
        coverage_pct: filtered.length > 0 ? Math.round((withValue / filtered.length) * 100) : 0,
        at_risk_open_overdue: atRisk,
      },
      data_quality: {
        coverage_note: `Deal value populated for ${withValue} of ${filtered.length} deals (${filtered.length > 0 ? Math.round((withValue/filtered.length)*100) : 0}% coverage). ${filtered.length < data_quality.total_rows ? filtered.length + ' of ' + data_quality.total_rows + ' total deals match filters.' : ''}`,
        normalizations: data_quality.normalizations || [],
      },
      breakdowns: { by_status: byStatus, by_sector: bySector, by_stage: byStage, by_owner: byOwner },
      top_deals_by_value: topDeals,
    };
  } catch (err) {
    return { error: err.message };
  }
}
