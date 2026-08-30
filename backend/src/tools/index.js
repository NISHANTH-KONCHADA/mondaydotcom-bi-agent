import { getDeals } from './getDeals.js';
import { getWorkOrders } from './getWorkOrders.js';
import { aggregate } from './aggregate.js';
import { joinBoards } from './joinBoards.js';
import { getSchema } from './getSchema.js';

/**
 * Tool definitions with MINIMAL schemas to avoid Groq validation errors.
 * This model (openai/gpt-oss-120b) sends null for optional params causing validation failures.
 * Solution: Accept a single JSON string argument, parse it ourselves.
 */
export const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'get_schema',
      description: 'Get column metadata, enum values, and known data caveats for both boards. Call this first if unsure what fields exist.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
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
Returns rows + data_quality block with null coverage stats.`,
      parameters: {
        type: 'object',
        properties: {
          filters: {
            type: 'string',
            description: 'JSON string of filter options. Use "{}" to get all deals. Example: {"sector":["Mining"],"status":["Open"]}',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_work_orders',
      description: `Fetch normalized work orders from the Work Orders board.
Pass a JSON filters object as the "filters" string parameter.
Available filter keys (all optional — omit keys you don't need):
- sector: array of strings (Mining, Powerline, Renewables, Railways, DSP, Construction, Others)
- execution_status: array of strings (Completed, Ongoing, "Not Started", "Executed until current month")
- billing_status: array of strings ("Fully Billed", "Partially Billed", Billed, "Not Billed Yet", "Update Required")
- wo_status: array of strings (Open, Closed) — tracks BILLING lifecycle, NOT field work
- owner: array of strings (e.g. ["OWNER_001"])
- hasAnomaly: boolean (true = only negative "amount to be billed" rows)
- arPriorityOnly: boolean (true = only AR priority accounts)
Example: {"sector":["Mining"],"wo_status":["Open"]}
Returns rows + data_quality block.`,
      parameters: {
        type: 'object',
        properties: {
          filters: {
            type: 'string',
            description: 'JSON string of filter options. Use "{}" to get all work orders. Example: {"sector":["Mining"]}',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'aggregate',
      description: `Aggregate an array of rows (from get_deals or get_work_orders) by grouping on a field.
Pass the rows array and aggregation config as a JSON string.
Config keys:
- rows: the rows array from previous tool result (required)
- group_by: field to group by (required). Deals: sector, dealStatus, dealStage, ownerCode. WO: sector, executionStatus, billingStatus, woStatus, ownerCode
- metric: "count", "sum", or "avg" (required)
- value_field: for sum/avg — field name. Deals: dealValue. WO: amountExclGST, billedValueExclGST, collectedAmount, amountReceivable
- top_n: number, limit results
Example: {"rows": [...], "group_by": "sector", "metric": "count"}`,
      parameters: {
        type: 'object',
        required: ['config'],
        properties: {
          config: {
            type: 'string',
            description: 'JSON string with rows, group_by, metric, and optional value_field/top_n.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'join_boards',
      description: `Cross-board join between Deals and Work Orders by deal name.
Use for: "which won deals don't have a work order?", "orphan work orders", rep performance across both boards.
Pass a JSON config string.
Config keys (all optional):
- deal_filters: filters for deals side (same as get_deals filters)
- wo_filters: filters for WO side (same as get_work_orders filters)
- show_unmatched_deals: boolean (default true) — show deals with no matching WO
- show_unmatched_wos: boolean (default true) — show WOs with no matching deal
CAVEAT: Join is by deal name which is NOT unique. Matches may be ambiguous — caveats always included in result.`,
      parameters: {
        type: 'object',
        properties: {
          config: {
            type: 'string',
            description: 'JSON string config. Use "{}" to join all data. Example: {"deal_filters":{"status":["Won"]}}',
          },
        },
      },
    },
  },
];

export async function executeToolCall(name, rawArgs) {
  console.log(`[tool] ${name}`, JSON.stringify(rawArgs).slice(0, 200));
  
  switch (name) {
    case 'get_schema':
      return getSchema();
      
    case 'get_deals': {
      let filters = {};
      if (rawArgs.filters) {
        try { filters = typeof rawArgs.filters === 'string' ? JSON.parse(rawArgs.filters) : rawArgs.filters; }
        catch { filters = {}; }
      }
      return await getDeals(filters);
    }
    
    case 'get_work_orders': {
      let filters = {};
      if (rawArgs.filters) {
        try { filters = typeof rawArgs.filters === 'string' ? JSON.parse(rawArgs.filters) : rawArgs.filters; }
        catch { filters = {}; }
      }
      return await getWorkOrders(filters);
    }
    
    case 'aggregate': {
      let config = {};
      if (rawArgs.config) {
        try { config = typeof rawArgs.config === 'string' ? JSON.parse(rawArgs.config) : rawArgs.config; }
        catch { config = {}; }
      }
      // Also support direct rows passed as rawArgs (from failed_generation recovery)
      if (rawArgs.rows) config = rawArgs;
      return aggregate(config);
    }
    
    case 'join_boards': {
      let config = {};
      if (rawArgs.config) {
        try { config = typeof rawArgs.config === 'string' ? JSON.parse(rawArgs.config) : rawArgs.config; }
        catch { config = {}; }
      }
      return await joinBoards(config);
    }
    
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
