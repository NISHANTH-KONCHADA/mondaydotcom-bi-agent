const MONDAY_API_URL = 'https://api.monday.com/v2';

/**
 * Execute a Monday.com GraphQL query.
 */
export async function mondayQuery(query, variables = {}) {
  const token = process.env.MONDAY_API_KEY;
  if (!token) throw new Error('MONDAY_API_KEY is not set');

  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'API-Version': '2024-10',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Monday.com HTTP ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Monday.com GraphQL error: ${json.errors[0].message}`);
  }
  return json.data;
}

/**
 * Fetch ALL items from a board, handling cursor pagination.
 * Returns { columns, items }
 */
export async function fetchAllBoardItems(boardId) {
  // 1. Fetch column metadata
  const colData = await mondayQuery(`
    query {
      boards(ids: [${boardId}]) {
        columns { id title type }
      }
    }
  `);
  const columns = colData.boards[0].columns;

  // 2. Paginate items
  const allItems = [];
  let cursor = null;

  do {
    const cursorStr = cursor ? `, cursor: "${cursor}"` : '';
    const data = await mondayQuery(`
      query {
        boards(ids: [${boardId}]) {
          items_page(limit: 500${cursorStr}) {
            cursor
            items {
              id
              name
              column_values { id text value }
            }
          }
        }
      }
    `);
    const page = data.boards[0].items_page;
    allItems.push(...page.items);
    cursor = page.cursor || null;
  } while (cursor);

  return { columns, items: allItems };
}

/**
 * Convert a raw Monday.com item into a flat key→value map using column titles.
 * Uses the `text` field (human-readable) for all values.
 */
export function flattenItem(item, columns) {
  const colMap = Object.fromEntries(columns.map(c => [c.id, c.title]));
  const row = { _id: item.id, 'name': item.name };
  for (const cv of item.column_values) {
    const title = colMap[cv.id] || cv.id;
    row[title] = cv.text || null;
  }
  return row;
}
