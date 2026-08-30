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

function matchesFilter(deal, filters) {
  const f = filters || {};

  if (f.sector?.length) {
    if (!deal.sector) return false;
    const s = deal.sector.toLowerCase();
    if (!f.sector.some(sec => s.includes(sec.toLowerCase()))) return false;
  }
  if (f.status?.length) {
    if (!deal.dealStatus) return false;
    if (!f.status.some(st => deal.dealStatus.toLowerCase() === st.toLowerCase())) return false;
  }
  if (f.stage?.length) {
    if (!deal.dealStage) return false;
    if (!f.stage.some(st => deal.dealStage.toLowerCase().includes(st.toLowerCase()))) return false;
  }
  if (f.owner?.length) {
    if (!deal.ownerCode) return false;
    if (!f.owner.some(o => deal.ownerCode.toLowerCase() === o.toLowerCase())) return false;
  }
  if (f.closeDateFrom || f.closeDateTo) {
    if (!isDateInRange(deal.tentativeCloseDate, f.closeDateFrom, f.closeDateTo)) return false;
  }
  if (f.closeDate) { // backward compat
    if (!isDateInRange(deal.tentativeCloseDate, f.closeDate?.from, f.closeDate?.to)) return false;
  }
  if (f.hasValue === true && deal.dealValue === null) return false;
  if (f.hasValue === false && deal.dealValue !== null) return false;

  return true;
}

export const getDealsToolDef = {
  type: 'function',
  function: {
    name: 'get_deals',
    description: `Fetch normalized deals from the Deals Pipeline board with optional filters.
Returns rows + data_quality block. OMIT any filter parameter you do not need — do NOT pass null.
Use tentativeCloseDate for date-based queries. Closure Probability is 75% null — avoid filtering on it.`,
    parameters: {
      type: 'object',
      properties: {
        sector: {
          type: 'array', items: { type: 'string' },
          description: 'Filter by sector. Values: Mining, Powerline, Renewables, Railways, DSP, Tender, Others, Construction.',
        },
        status: {
          type: 'array', items: { type: 'string' },
          description: 'Filter by Deal Status. Values: Open, Won, Dead, On Hold.',
        },
        stage: {
          type: 'array', items: { type: 'string' },
          description: 'Filter by Deal Stage substring (e.g. Won, Proposal, Negotiations, Lead).',
        },
        owner: {
          type: 'array', items: { type: 'string' },
          description: 'Filter by Owner code e.g. OWNER_001.',
        },
        closeDateFrom: {
          type: 'string',
          description: 'Filter Tentative Close Date >= this ISO date (YYYY-MM-DD).',
        },
        closeDateTo: {
          type: 'string',
          description: 'Filter Tentative Close Date <= this ISO date (YYYY-MM-DD).',
        },
        hasValue: {
          type: 'boolean',
          description: 'true = only deals with a deal value; false = only deals without.',
        },
      },
    },
  },
};

export async function getDeals(filters) {
  try {
    const { deals, data_quality } = await loadDeals();
    const filtered = deals.filter(d => matchesFilter(d, filters));

    // Compute filtered-slice quality stats
    const withValue = filtered.filter(d => d.dealValue !== null).length;
    const qualitySlice = {
      ...data_quality,
      rows_returned: filtered.length,
      with_deal_value_count: withValue,
      null_deal_value_count: filtered.length - withValue,
      coverage_note: filtered.length > 0
        ? `Deal value populated for ${withValue} of ${filtered.length} matching deals (${Math.round((withValue / filtered.length) * 100)}% coverage). ` +
          (filtered.length < deals.length ? `(${filtered.length} of ${deals.length} total deals match your filters.)` : '')
        : 'No matching deals found.',
    };

    return { rows: filtered, data_quality: qualitySlice };
  } catch (err) {
    return { rows: [], data_quality: { error: err.message }, error: err.message };
  }
}
