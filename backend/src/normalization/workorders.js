/**
 * WORK ORDERS NORMALIZATION
 *
 * Handles all known data quality issues in the Work Orders board:
 * - Blank first row (export artifact) → Monday.com import skips this automatically
 * - Billing Status free-text typos: "BIlled", "Billed", "Fully Billed" etc. → normalized
 * - Negative "Amount to be billed" → real over-billing signal, flagged as anomaly
 * - WO Status (billed) ≠ Execution Status → two separate lifecycles, never conflated
 * - Quantity columns may embed units ("5360 HA", "L/s") → numeric part parsed, unit stored
 * - BD/KAM Personnel code (WO) == Owner code (Deals) value space (OWNER_00X)
 */

function parseDate(str) {
  if (!str || str.trim() === '') return null;
  const d = new Date(str.trim());
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

function parseNumber(str) {
  if (!str || str.trim() === '') return null;
  const cleaned = str.replace(/[,₹$€\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseQuantity(str) {
  if (!str || str.trim() === '') return { value: null, unit: null };
  // Extract leading number, rest is unit
  const match = str.trim().match(/^([\d,.]+)\s*(.*)?$/);
  if (!match) return { value: null, unit: str.trim() };
  const val = parseFloat(match[1].replace(/,/g, ''));
  return { value: isNaN(val) ? null : val, unit: match[2]?.trim() || null };
}

// Canonical billing status mapping (case-insensitive)
const BILLING_STATUS_MAP = {
  'billed': 'Billed',
  'fully billed': 'Fully Billed',
  'partially billed': 'Partially Billed',
  'not billed yet': 'Not Billed Yet',
  'update required': 'Update Required',
  'billed- visit 7': 'Partially Billed', // pattern for visit-based billing
};

function normalizeBillingStatus(raw) {
  if (!raw || raw.trim() === '') return null;
  const key = raw.toLowerCase().trim();
  // Exact match
  if (BILLING_STATUS_MAP[key]) return BILLING_STATUS_MAP[key];
  // Prefix match for "billed- visit X" patterns
  if (key.startsWith('billed-') || key.startsWith('billed –')) return 'Partially Billed';
  // Fallback: title-case the original
  return raw.trim();
}

export function normalizeWorkOrder(raw) {
  const amountToBeBilledExcl = parseNumber(raw['Amount to be billed in Rs. (Exl. of GST) (Masked)']);
  const amountToBeBilledIncl = parseNumber(raw['Amount to be billed in Rs. (Incl. of GST) (Masked)']);
  const rawBillingStatus = raw['Billing Status'];
  const normalizedBillingStatus = normalizeBillingStatus(rawBillingStatus);
  const billingStatusWasNormalized =
    rawBillingStatus && normalizedBillingStatus !== rawBillingStatus?.trim();
  const qty = parseQuantity(raw['Quantities as per PO'] || raw['Quantity by Ops'] || '');

  return {
    dealName:            raw['name'] || raw['Deal name masked'] || null,
    customerCode:        raw['Customer Name Code'] || null,
    serialNo:            raw['Serial #'] || null,
    natureOfWork:        raw['Nature of Work'] || null,
    lastExecutedMonth:   raw['Last executed month of recurring project'] || null,
    executionStatus:     raw['Execution Status'] || null,
    dataDeliveryDate:    parseDate(raw['Data Delivery Date']),
    dateOfPO:            parseDate(raw['Date of PO/LOI']),
    documentType:        raw['Document Type'] || null,
    probableStartDate:   parseDate(raw['Probable Start Date']),
    probableEndDate:     parseDate(raw['Probable End Date']),
    ownerCode:           raw['BD/KAM Personnel code'] || null,
    sector:              raw['Sector'] || null,
    typeOfWork:          raw['Type of Work'] || null,
    softwarePlatform:    raw['Is any Skylark software platform part of the client deliverables in this deal?'] || null,
    lastInvoiceDate:     parseDate(raw['Last invoice date']),
    invoiceNo:           raw['latest invoice no.'] || null,
    amountExclGST:       parseNumber(raw['Amount in Rupees (Excl of GST) (Masked)']),
    amountInclGST:       parseNumber(raw['Amount in Rupees (Incl of GST) (Masked)']),
    billedValueExclGST:  parseNumber(raw['Billed Value in Rupees (Excl of GST.) (Masked)']),
    billedValueInclGST:  parseNumber(raw['Billed Value in Rupees (Incl of GST.) (Masked)']),
    collectedAmount:     parseNumber(raw['Collected Amount in Rupees (Incl of GST.) (Masked)']),
    amountToBeBilledExcl,
    amountToBeBilledIncl,
    amountReceivable:    parseNumber(raw['Amount Receivable (Masked)']),
    arPriority:          raw['AR Priority account'] || null,
    quantityByOps:       parseQuantity(raw['Quantity by Ops']).value,
    quantityPerPO:       qty.value,
    quantityUnit:        qty.unit,
    quantityBilled:      parseNumber(raw['Quantity billed (till date)']),
    invoiceStatus:       raw['Invoice Status'] || null,
    expectedBillingMonth: raw['Expected Billing Month'] || null,
    actualBillingMonth:   raw['Actual Billing Month'] || null,
    actualCollectionMonth: raw['Actual Collection Month'] || null,
    woStatus:            raw['WO Status (billed)'] || null,
    collectionStatus:    raw['Collection status'] || null,
    collectionDate:      parseDate(raw['Collection Date']),
    billingStatus:       normalizedBillingStatus,
    // Anomaly flags
    isNegativeBilling:   amountToBeBilledExcl !== null && amountToBeBilledExcl < 0,
    _billingStatusNormalized: billingStatusWasNormalized,
    _rawBillingStatus:   rawBillingStatus,
  };
}

export function normalizeWorkOrders(rawItems) {
  const workOrders = [];
  let nullSectorCount = 0;
  let nullOwnerCount = 0;
  let negativeBillingCount = 0;
  let billingStatusNormalizedCount = 0;
  const billingStatusVariants = new Set();

  for (const raw of rawItems) {
    // Skip if this looks like a blank row (no serial no and no customer code)
    if (!raw['Customer Name Code'] && !raw['Serial #'] && !raw['name']) continue;

    const wo = normalizeWorkOrder(raw);
    workOrders.push(wo);

    if (!wo.sector) nullSectorCount++;
    if (!wo.ownerCode) nullOwnerCount++;
    if (wo.isNegativeBilling) negativeBillingCount++;
    if (wo._billingStatusNormalized) billingStatusNormalizedCount++;
    if (wo._rawBillingStatus) billingStatusVariants.add(wo._rawBillingStatus.trim());
  }

  const total = workOrders.length;
  const withAmount = workOrders.filter(w => w.amountExclGST !== null).length;

  return {
    workOrders,
    data_quality: {
      total_rows: total,
      null_sector_count: nullSectorCount,
      null_owner_count: nullOwnerCount,
      negative_billing_count: negativeBillingCount,
      billing_status_normalized_count: billingStatusNormalizedCount,
      with_amount_count: withAmount,
      coverage_note: `Contract value populated for ${withAmount} of ${total} work orders.`,
      normalizations: [
        ...(billingStatusNormalizedCount > 0
          ? [`Billing Status normalized from ${billingStatusVariants.size} raw variants (e.g., "BIlled" → "Billed"). ${billingStatusNormalizedCount} rows affected.`]
          : []),
      ],
      anomalies: [
        ...(negativeBillingCount > 0
          ? [`${negativeBillingCount} work order${negativeBillingCount > 1 ? 's' : ''} with negative "Amount to be billed" — likely over-billed vs PO. Review flagged.`]
          : []),
      ],
    },
  };
}
