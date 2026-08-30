import { fetchAllBoardItems, flattenItem } from '../monday/client.js';
import { normalizeDeals } from '../normalization/deals.js';
import { normalizeWorkOrders } from '../normalization/workorders.js';
import * as cache from '../cache.js';

const DEALS_BOARD_ID = process.env.MONDAY_DEALS_BOARD_ID;
const WO_BOARD_ID = process.env.MONDAY_WORK_ORDERS_BOARD_ID;

async function loadNormalizedData() {
  let dealsData = cache.get('deals_normalized');
  if (!dealsData) {
    const { columns, items } = await fetchAllBoardItems(DEALS_BOARD_ID);
    const flatItems = items.map(item => flattenItem(item, columns));
    dealsData = normalizeDeals(flatItems);
    cache.set('deals_normalized', dealsData);
  }

  let woData = cache.get('work_orders_normalized');
  if (!woData) {
    const { columns, items } = await fetchAllBoardItems(WO_BOARD_ID);
    const flatItems = items.map(item => flattenItem(item, columns));
    woData = normalizeWorkOrders(flatItems);
    cache.set('work_orders_normalized', woData);
  }

  return { deals: dealsData.deals, workOrders: woData.workOrders };
}

export const joinBoardsToolDef = {
  type: 'function',
  function: {
    name: 'join_boards',
    description: `Cross-board join between Deals Pipeline and Work Orders.
Use for: "which won deals don't have a work order?", "orphan work orders", "cross-board pipeline vs execution".
Pass optional JSON config string: {"deal_status":["Won"]} or "{}".
Returns matched statistics, list of won/open deals without a work order, orphan work orders, and ambiguity caveats.`,
    parameters: {
      type: 'object',
      properties: {
        config: {
          type: 'string',
          description: 'JSON string of options. Example: {"deal_status":["Won"]}',
        },
      },
    },
  },
};

export async function joinBoards(config = {}) {
  try {
    const { deals, workOrders } = await loadNormalizedData();

    // Lookup work orders by deal name
    const woByDealName = new Map();
    for (const wo of workOrders) {
      if (!wo.dealName) continue;
      const key = wo.dealName.trim().toLowerCase();
      if (!woByDealName.has(key)) woByDealName.set(key, []);
      woByDealName.get(key).push(wo);
    }

    // Lookup deals by deal name
    const dealsByName = new Map();
    for (const d of deals) {
      if (!d.dealName) continue;
      const key = d.dealName.trim().toLowerCase();
      if (!dealsByName.has(key)) dealsByName.set(key, []);
      dealsByName.get(key).push(d);
    }

    const ambiguousDealNames = new Set();
    for (const [name, ds] of dealsByName.entries()) {
      const clients = new Set(ds.map(d => d.clientCode).filter(Boolean));
      if (clients.size > 1) ambiguousDealNames.add(name);
    }

    // Filter deals if requested in config
    let filteredDeals = deals;
    if (config.deal_status && Array.isArray(config.deal_status)) {
      filteredDeals = deals.filter(d =>
        d.dealStatus && config.deal_status.some(st => d.dealStatus.toLowerCase() === st.toLowerCase())
      );
    }

    const matchedDeals = [];
    const dealsWithoutWO = [];
    const matchedWoSerials = new Set();

    for (const d of filteredDeals) {
      if (!d.dealName) {
        dealsWithoutWO.push({ dealName: 'Unknown', clientCode: d.clientCode, status: d.dealStatus, value: d.dealValue });
        continue;
      }
      const key = d.dealName.trim().toLowerCase();
      const matchedWOs = woByDealName.get(key) || [];
      if (matchedWOs.length > 0) {
        matchedDeals.push({
          dealName: d.dealName,
          clientCode: d.clientCode,
          dealStatus: d.dealStatus,
          dealValue: d.dealValue,
          workOrderCount: matchedWOs.length,
          isAmbiguous: ambiguousDealNames.has(key),
        });
        matchedWOs.forEach(w => matchedWoSerials.add(w.serialNo));
      } else {
        dealsWithoutWO.push({
          dealName: d.dealName,
          clientCode: d.clientCode,
          ownerCode: d.ownerCode,
          dealStatus: d.dealStatus,
          dealStage: d.dealStage,
          dealValue: d.dealValue,
          tentativeCloseDate: d.tentativeCloseDate,
          sector: d.sector,
        });
      }
    }

    const orphanWorkOrders = workOrders
      .filter(w => !matchedWoSerials.has(w.serialNo))
      .slice(0, 10)
      .map(w => ({
        serialNo: w.serialNo,
        dealName: w.dealName,
        customerCode: w.customerCode,
        ownerCode: w.ownerCode,
        sector: w.sector,
        amountExclGST: w.amountExclGST,
      }));

    return {
      summary: {
        total_deals_analyzed: filteredDeals.length,
        total_work_orders_in_board: workOrders.length,
        matched_deals_count: matchedDeals.length,
        deals_without_work_order_count: dealsWithoutWO.length,
        orphan_work_orders_count: workOrders.length - matchedWoSerials.size,
      },
      caveats: [
        'Join strategy: matched on normalized Deal Name (case-insensitive). Company codes cannot be joined directly because Work Orders uses WOCOMPANY_XXX and Deals uses COMPANY_XXX namespaces.',
        `${ambiguousDealNames.size} Deal Name(s) are shared across multiple different clients (e.g. masked names like "Sakura"), which makes exact 1:1 attribution ambiguous.`,
      ],
      deals_without_work_order_sample: dealsWithoutWO.slice(0, 15),
      orphan_work_orders_sample: orphanWorkOrders,
    };
  } catch (err) {
    return { error: err.message };
  }
}
