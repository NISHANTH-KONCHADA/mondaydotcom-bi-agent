export const aggregateToolDef = {
  type: 'function',
  function: {
    name: 'aggregate',
    description: `Aggregate rows returned by get_deals or get_work_orders.
Pass the rows array directly from the previous tool's result.rows.
OMIT optional parameters you don't need — do NOT pass null.
Always reports null coverage for financial fields.`,
    parameters: {
      type: 'object',
      required: ['group_by', 'metric'],
      properties: {
        rows: {
          type: 'array',
          description: 'Array of row objects from get_deals or get_work_orders result.rows.',
          items: { type: 'object' },
        },
        group_by: {
          type: 'string',
          description: 'Field to group by. Deals fields: sector, dealStatus, dealStage, ownerCode, closureProbability. WO fields: sector, executionStatus, billingStatus, woStatus, ownerCode, natureOfWork.',
        },
        metric: {
          type: 'string',
          enum: ['count', 'sum', 'avg'],
          description: '"count" = number of rows per group. "sum"/"avg" require value_field.',
        },
        value_field: {
          type: 'string',
          description: 'For sum/avg: field name to compute on. Deals: dealValue. WO: amountExclGST, amountInclGST, billedValueExclGST, collectedAmount, amountReceivable.',
        },
        sort_desc: {
          type: 'boolean',
          description: 'Sort groups by value descending. Default true.',
        },
        top_n: {
          type: 'number',
          description: 'Return only top N groups.',
        },
      },
    },
  },
};


export function aggregate({ rows, group_by, metric, value_field, sort_desc = true, top_n }) {
  if (!rows || rows.length === 0) {
    return { groups: [], coverage: 'No rows to aggregate.' };
  }

  // Build groups
  const groupMap = new Map();
  let totalWithValue = 0;
  let totalRows = rows.length;

  for (const row of rows) {
    const key = row[group_by] ?? '(null/unknown)';
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key).push(row);
  }

  const groups = [];
  for (const [key, groupRows] of groupMap.entries()) {
    let value;
    let coverage = null;

    if (metric === 'count') {
      value = groupRows.length;
    } else if (metric === 'sum' || metric === 'avg') {
      if (!value_field) {
        return { error: 'value_field is required for sum/avg metric.' };
      }
      const validRows = groupRows.filter(r => r[value_field] !== null && r[value_field] !== undefined);
      const sum = validRows.reduce((acc, r) => acc + (r[value_field] || 0), 0);
      totalWithValue += validRows.length;
      value = metric === 'sum' ? sum : (validRows.length > 0 ? sum / validRows.length : 0);
      if (validRows.length < groupRows.length) {
        coverage = `${validRows.length}/${groupRows.length} rows have a value`;
      }
    }

    groups.push({ key, value: Math.round(value * 100) / 100, count: groupRows.length, coverage });
  }

  // Sort
  if (sort_desc !== false) {
    groups.sort((a, b) => b.value - a.value);
  }

  // Top N
  const result = top_n ? groups.slice(0, top_n) : groups;

  // Overall coverage note for financial fields
  let overallCoverage = null;
  if ((metric === 'sum' || metric === 'avg') && value_field) {
    overallCoverage = `${value_field} was populated in ${totalWithValue} of ${totalRows} rows across all groups.`;
  }

  return { groups: result, total_groups: groupMap.size, overall_coverage: overallCoverage };
}
