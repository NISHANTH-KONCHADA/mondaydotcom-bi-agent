/**
 * DEALS NORMALIZATION
 *
 * Handles all known data quality issues in the Deals board:
 * - Stray embedded header row (Deal Stage == "Deal Stage") → filtered out
 * - "Project Completed" stage has no letter prefix → mapped to "P. Project Completed"
 * - Closure Probability null in ~75% of rows → treated as sparse enrichment
 * - Masked Deal value null in ~52% of rows → coverage always reported
 * - Close Date (A) null in ~92% of rows → Tentative Close Date used as primary
 * - Sector/service: "Tender" kept as-is (documented as deal-acquisition type, not vertical)
 * - Duplicate Client Code + Deal Name combos → treated as separate snapshots/tranches
 */

function parseDate(str) {
  if (!str || str.trim() === '') return null;
  const d = new Date(str.trim());
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

function parseNumber(str) {
  if (!str || str.trim() === '') return null;
  // Remove commas, currency symbols, spaces
  const cleaned = str.replace(/[,₹$€\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

const DEAL_STAGE_NORMALIZE = {
  'Project Completed': 'P. Project Completed',
};

/**
 * Normalize a single deal row (from Monday.com flat mapping).
 * Returns null if the row is a stray header.
 */
export function normalizeDeal(raw) {
  // Filter stray header rows embedded as data
  const stage = raw['Deal Stage'] || '';
  if (stage.trim() === 'Deal Stage') return null;

  const normalizedStage = DEAL_STAGE_NORMALIZE[stage.trim()] || stage.trim() || null;
  const dealValue = parseNumber(raw['Masked Deal value']);

  return {
    dealName:           raw['name'] || raw['Deal Name'] || null,
    ownerCode:          raw['Owner code'] || null,
    clientCode:         raw['Client Code'] || null,
    dealStatus:         raw['Deal Status'] || null,
    closeDateActual:    parseDate(raw['Close Date (A)']),
    closureProbability: raw['Closure Probability'] || null,
    dealValue,
    tentativeCloseDate: parseDate(raw['Tentative Close Date']),
    dealStage:          normalizedStage,
    productDeal:        raw['Product deal'] || null,
    sector:             raw['Sector/service'] || null,
    createdDate:        parseDate(raw['Created Date']),
    _stageNormalized:   stage.trim() !== normalizedStage && normalizedStage !== null,
  };
}

/**
 * Normalize a full list of deals and produce a data quality report.
 */
export function normalizeDeals(rawItems) {
  const deals = [];
  let droppedHeaderRows = 0;
  let nullValueCount = 0;
  let nullStageCount = 0;
  let nullSectorCount = 0;
  let nullOwnerCount = 0;
  let stageNormalizedCount = 0;

  for (const raw of rawItems) {
    const d = normalizeDeal(raw);
    if (d === null) { droppedHeaderRows++; continue; }

    if (d.dealValue === null) nullValueCount++;
    if (!d.dealStage) nullStageCount++;
    if (!d.sector) nullSectorCount++;
    if (!d.ownerCode) nullOwnerCount++;
    if (d._stageNormalized) stageNormalizedCount++;

    deals.push(d);
  }

  const total = deals.length;
  const withValue = deals.filter(d => d.dealValue !== null).length;

  return {
    deals,
    data_quality: {
      total_rows: total,
      dropped_header_rows: droppedHeaderRows,
      null_deal_value_count: nullValueCount,
      null_deal_value_pct: total ? Math.round((nullValueCount / total) * 100) : 0,
      with_deal_value_count: withValue,
      null_stage_count: nullStageCount,
      null_sector_count: nullSectorCount,
      null_owner_count: nullOwnerCount,
      stage_normalized_count: stageNormalizedCount,
      coverage_note: `Deal value populated for ${withValue} of ${total} rows (${total - nullValueCount > 0 ? Math.round((withValue / total) * 100) : 0}% coverage). Tentative Close Date is the primary date field (Actual Close Date is sparsely populated).`,
      normalizations: stageNormalizedCount > 0
        ? [`"Project Completed" stage mapped to "P. Project Completed" (${stageNormalizedCount} row${stageNormalizedCount > 1 ? 's' : ''})`]
        : [],
    },
  };
}
