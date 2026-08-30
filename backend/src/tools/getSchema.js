export const getSchemaToolDef = {
  type: 'function',
  function: {
    name: 'get_schema',
    description: 'Get the schema, column metadata, enum values, and known data caveats for both boards. Call this first if unsure what fields or values exist.',
    parameters: { type: 'object', properties: {} },
  },
};

export function getSchema() {
  return {
    deals_board: {
      description: 'Deals Pipeline — 346 rows, tracks the sales funnel from lead to won deal.',
      columns: {
        dealName:           { type: 'string', note: 'Masked/anonymized deal name. NOT unique across clients.' },
        ownerCode:          { type: 'string', values: ['OWNER_001','OWNER_002','OWNER_003','OWNER_004','OWNER_005','OWNER_006','OWNER_007','OWNER_008'], note: '~8 nulls in dead deals' },
        clientCode:         { type: 'string', note: 'COMPANY_XXX format. Cannot be joined to WO customerCode (WO uses WOCOMPANY_XXX prefix).' },
        dealStatus:         { type: 'string', values: ['Open','Won','Dead','On Hold'], note: 'Clean field, ~1 null' },
        closeDateActual:    { type: 'date', note: 'Null in ~92% of rows. NOT reliable for date queries. Use tentativeCloseDate instead.' },
        closureProbability: { type: 'string', values: ['High','Medium','Low'], note: 'NULL in ~75% of rows — sparse enrichment only.' },
        dealValue:          { type: 'number', note: 'Masked Deal value in INR. NULL in ~52% of rows. Always report coverage when aggregating.' },
        tentativeCloseDate: { type: 'date', note: 'Primary date field for forward-looking queries. Better populated than closeDateActual.' },
        dealStage:          { type: 'string', values: ['A. Lead Generated','B. Sales Qualified Leads','C. Prospecting/Demo','D. Feasibility','E. Proposal/Commercials Sent','F. Negotiations','G. Project Won','H. Work Order Received','I. PO/LOI Received','J. Invoice sent','K. Payment Received','L. Project Lost','M. Projects On Hold','N. Not relevant at the moment','O. Duplicate','P. Project Completed'], note: '"Project Completed" was mapped to P. (no letter in raw data).' },
        productDeal:        { type: 'string', values: ['Pure Service','Service + Spectra','Hardware','Spectra + DMO','Dock + DMO + Spectra + Service','Dock + Spectra + Service'], note: 'Many nulls' },
        sector:             { type: 'string', values: ['Mining','Powerline','Renewables','Railways','DSP','Tender','Others','Construction'], note: '8 nulls. "Tender" is a deal-type that appears as sector — documented limitation.' },
        createdDate:        { type: 'date', note: 'When the deal was created in CRM.' },
      },
      known_caveats: [
        'Duplicate Deal Name + Client Code combos exist (e.g., COMPANY111 appears 3×) — treated as separate tranches/snapshots, not deduplicated.',
        'Deal Name is masked/anonymized — "Sakura" appears 30+ times for different clients.',
        'Stray embedded header row (Deal Stage = "Deal Stage") was filtered during normalization.',
      ],
    },
    work_orders_board: {
      description: 'Work Orders — 176 rows, tracks project execution and billing lifecycle.',
      columns: {
        dealName:            { type: 'string', note: 'Masked deal name. Joins to deals.dealName but ambiguous (not unique).' },
        customerCode:        { type: 'string', note: 'WOCOMPANY_XXX format. Different prefix from deals.clientCode — cannot join directly.' },
        serialNo:            { type: 'string', note: 'Unique WO identifier (SDPLDEAL-XXX).' },
        natureOfWork:        { type: 'string', values: ['One time Project','Monthly Contract','Annual Rate Contract','Proof of Concept'] },
        executionStatus:     { type: 'string', values: ['Completed','Ongoing','Not Started','Executed until current month','Details pending from Client'], note: 'Tracks FIELD WORK lifecycle, NOT billing.' },
        woStatus:            { type: 'string', values: ['Open','Closed'], note: 'Tracks BILLING lifecycle, NOT field work. Never conflate with executionStatus.' },
        billingStatus:       { type: 'string', values: ['Fully Billed','Partially Billed','Billed','Not Billed Yet','Update Required'], note: 'Normalized from 4+ raw variants (e.g., "BIlled" → "Billed").' },
        ownerCode:           { type: 'string', note: 'BD/KAM Personnel code. Same OWNER_00X value space as deals.ownerCode — cross-board join key.' },
        sector:              { type: 'string', values: ['Mining','Powerline','Renewables','Railways','DSP','Construction','Others'] },
        amountExclGST:       { type: 'number', note: 'Total contract value excl GST (masked). Key revenue metric.' },
        amountInclGST:       { type: 'number', note: 'Total contract value incl GST (masked).' },
        billedValueExclGST:  { type: 'number', note: 'Amount invoiced so far excl GST.' },
        collectedAmount:     { type: 'number', note: 'Cash actually received.' },
        amountToBeBilledExcl:{ type: 'number', note: 'Remaining billing amount. NEGATIVE values = over-billed vs PO (real anomaly, not data error).' },
        amountReceivable:    { type: 'number', note: 'Outstanding receivables.' },
        arPriority:          { type: 'string', note: 'Marks high-priority AR accounts for collection.' },
        isNegativeBilling:   { type: 'boolean', note: 'True when amountToBeBilledExcl < 0 (over-billed anomaly).' },
      },
      known_caveats: [
        'Billing Status had typos ("BIlled") and inconsistent casing — normalized to canonical set.',
        'Negative "Amount to be billed" is a real business signal (over-billed vs PO), not a data error.',
        'WO Status and Execution Status track two different lifecycles — never conflate them.',
        'Quantity columns may embed units ("5360 HA") — numeric value extracted, unit stored separately.',
      ],
    },
    cross_board: {
      join_strategy: 'Match on normalized Deal Name (case-insensitive). Owner code (OWNER_00X) is shared across both boards.',
      known_limitation: 'Deal Name is not a unique key. "Sakura", "Alias_160" etc. appear for multiple different clients. Ambiguous matches are flagged.',
      company_code_mismatch: 'Deals uses COMPANY_XXX, Work Orders uses WOCOMPANY_XXX — cannot join on company codes.',
    },
  };
}
