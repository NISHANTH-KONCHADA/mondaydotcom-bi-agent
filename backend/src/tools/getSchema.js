export const getSchemaToolDef = {
  type: 'function',
  function: {
    name: 'get_schema',
    description: 'Get column metadata, enum values, and known data caveats for both boards. Call this first if unsure what fields exist.',
    parameters: { type: 'object', properties: {} },
  },
};

export function getSchema() {
  return {
    deals_board: {
      row_count: '~346 rows',
      item_name_field: 'dealName (masked, NOT unique — e.g. "Sakura" = 30+ clients)',
      key_fields: {
        ownerCode: 'OWNER_001 to OWNER_008 (8 nulls in dead deals)',
        clientCode: 'COMPANY_XXX format (cannot join to WO customerCode)',
        dealStatus: ['Open','Won','Dead','On Hold'],
        closeDateActual: '92% NULL — use tentativeCloseDate instead',
        closureProbability: 'High/Medium/Low — 75% NULL, sparse enrichment only',
        dealValue: 'INR, masked. NULL in ~52% rows. Always report coverage.',
        tentativeCloseDate: 'Primary date field for forward-looking queries',
        dealStage: ['A. Lead Generated','B. Sales Qualified Leads','C. Prospecting/Demo','D. Feasibility','E. Proposal/Commercials Sent','F. Negotiations','G. Project Won','H. Work Order Received','I. PO/LOI Received','J. Invoice sent','K. Payment Received','L. Project Lost','M. Projects On Hold','N. Not relevant at the moment','O. Duplicate','P. Project Completed'],
        sector: ['Mining','Powerline','Renewables','Railways','DSP','Tender','Others','Construction'],
        productDeal: 'Pure Service, Service + Spectra, Hardware, etc. (many nulls)',
      },
      caveats: [
        'Stray header row (Deal Stage="Deal Stage") filtered on ingest',
        '"Project Completed" mapped to P. (no letter in raw data)',
        'Duplicate Client Code + Deal Name = separate tranches, not deduplicated',
      ],
    },
    work_orders_board: {
      row_count: '~176 rows',
      item_name_field: 'dealName (masked, joins to deals.dealName but ambiguous)',
      key_fields: {
        customerCode: 'WOCOMPANY_XXX (DIFFERENT prefix from deals.clientCode — cannot join)',
        serialNo: 'Unique WO ID: SDPLDEAL-XXX',
        executionStatus: ['Completed','Ongoing','Not Started','Executed until current month','Details pending from Client'],
        woStatus: 'Open/Closed — BILLING lifecycle only (≠ executionStatus)',
        billingStatus: ['Fully Billed','Partially Billed','Billed','Not Billed Yet','Update Required'],
        ownerCode: 'BD/KAM code — SAME OWNER_00X space as deals.ownerCode (cross-board join key)',
        amountExclGST: 'Total contract value excl GST',
        billedValueExclGST: 'Amount invoiced so far',
        collectedAmount: 'Cash received',
        amountToBeBilledExcl: 'Remaining to bill. NEGATIVE = over-billed vs PO (anomaly)',
        amountReceivable: 'Outstanding receivables',
        arPriority: 'Priority/null — marks high-priority AR accounts',
      },
      caveats: [
        'Billing Status had typos (BIlled) — normalized to canonical set',
        'Negative amountToBeBilledExcl is real business signal, not data error',
        'woStatus ≠ executionStatus — never conflate',
      ],
    },
    cross_board_join: {
      strategy: 'Match on dealName (normalized, case-insensitive)',
      shared_key: 'ownerCode (OWNER_00X) is same across both boards',
      limitation: 'dealName not unique — ambiguous matches flagged in join_boards result',
      company_codes: 'Cannot join: deals uses COMPANY_XXX, WO uses WOCOMPANY_XXX',
    },
  };
}
