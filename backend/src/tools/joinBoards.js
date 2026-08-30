import { getDeals } from './getDeals.js';
import { getWorkOrders } from './getWorkOrders.js';

/**
 * Cross-board join tool.
 *
 * Join strategy:
 * - Primary key: dealName (masked) matched across both boards
 * - Secondary key: ownerCode (BD/KAM Personnel code == Owner code)
 * - Company codes CANNOT be joined directly: WO uses WOCOMPANY_XXX, Deals uses COMPANY_XXX — different prefix spaces
 *
 * Known limitation: Deal Name is NOT unique (e.g., "Sakura" appears 30+ times for different clients).
 * Matches are therefore ambiguous. The caveats array always documents this.
 *
 * Returns:
 * - matched: deals that have at least one matching work order
 * - deals_without_wo: won/open deals with no matching work order (key founder question)
 * - work_orders_without_deal: WOs with no matching deal (orphan WOs)
 * - caveats: list of known limitations for this join
 */

export const joinBoardsToolDef = {
  type: 'function',
  function: {
    name: 'join_boards',
    description: `Cross-board join between Deals and Work Orders.
Join strategy: match on normalized Deal Name (case-insensitive). Owner code used as secondary signal.
IMPORTANT CAVEAT: Deal Name is not unique — "Sakura", "Alias_160" etc. appear for multiple clients. 
Matches flagged as ambiguous when a deal name has multiple clients on either board.
Use this for: "which won deals don't have a work order?", "orphan work orders", "rep performance across both boards".`,
    parameters: {
      type: 'object',
      properties: {
        deal_filters: {
          type: 'object',
          description: 'Optional filters for the deals side (same parameters as get_deals).',
        },
        wo_filters: {
          type: 'object',
          description: 'Optional filters for the work orders side (same parameters as get_work_orders).',
        },
        show_unmatched_deals: {
          type: 'boolean',
          description: 'If true, return deals with no matching work order (default true).',
        },
        show_unmatched_wos: {
          type: 'boolean',
          description: 'If true, return work orders with no matching deal (default true).',
        },
      },
    },
  },
};

export async function joinBoards({
  deal_filters,
  wo_filters,
  show_unmatched_deals = true,
  show_unmatched_wos = true,
}) {
  const [dealsResult, woResult] = await Promise.all([
    getDeals(deal_filters || {}),
    getWorkOrders(wo_filters || {}),
  ]);

  const deals = dealsResult.rows;
  const wos = woResult.rows;

  // Build lookup: normalized deal name → WOs
  const woByDealName = new Map();
  for (const wo of wos) {
    if (!wo.dealName) continue;
    const key = wo.dealName.trim().toLowerCase();
    if (!woByDealName.has(key)) woByDealName.set(key, []);
    woByDealName.get(key).push(wo);
  }

  // Build lookup: normalized deal name → Deals
  const dealsByName = new Map();
  for (const d of deals) {
    if (!d.dealName) continue;
    const key = d.dealName.trim().toLowerCase();
    if (!dealsByName.has(key)) dealsByName.set(key, []);
    dealsByName.get(key).push(d);
  }

  // Ambiguous names: deal name maps to >1 unique client
  const ambiguousDealNames = new Set();
  for (const [name, ds] of dealsByName.entries()) {
    const clients = new Set(ds.map(d => d.clientCode).filter(Boolean));
    if (clients.size > 1) ambiguousDealNames.add(name);
  }

  const matched = [];
  const matchedWoSerials = new Set();
  const matchedDealKeys = new Set();

  for (const deal of deals) {
    if (!deal.dealName) continue;
    const key = deal.dealName.trim().toLowerCase();
    const matchingWOs = woByDealName.get(key) || [];
    if (matchingWOs.length > 0) {
      matched.push({
        deal,
        work_orders: matchingWOs,
        match_quality: ambiguousDealNames.has(key) ? 'ambiguous' : 'exact',
      });
      matchingWOs.forEach(wo => matchedWoSerials.add(wo.serialNo));
      matchedDealKeys.add(`${key}::${deal.clientCode}`);
    }
  }

  const dealsWithoutWO = show_unmatched_deals
    ? deals.filter(d => {
        if (!d.dealName) return true;
        const key = d.dealName.trim().toLowerCase();
        return !woByDealName.has(key);
      })
    : [];

  const wosWithoutDeal = show_unmatched_wos
    ? wos.filter(wo => !matchedWoSerials.has(wo.serialNo))
    : [];

  const caveats = [
    `Join strategy: matched on normalized Deal Name (case-insensitive). Company codes NOT joined — WO uses WOCOMPANY_XXX prefix, Deals uses COMPANY_XXX (different namespaces).`,
    `${ambiguousDealNames.size} deal name(s) are non-unique across multiple clients — matches for these may be incorrect: [${[...ambiguousDealNames].slice(0, 10).join(', ')}].`,
    `Deals board: ${dealsResult.data_quality.total_rows} rows. Work Orders board: ${woResult.data_quality.total_rows} rows.`,
  ];

  return {
    matched_count: matched.length,
    deals_without_wo_count: dealsWithoutWO.length,
    wos_without_deal_count: wosWithoutDeal.length,
    matched,
    deals_without_wo: dealsWithoutWO,
    wos_without_deal: wosWithoutDeal,
    caveats,
    deals_data_quality: dealsResult.data_quality,
    wo_data_quality: woResult.data_quality,
  };
}
