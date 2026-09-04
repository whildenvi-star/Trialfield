'use strict';

// Document intake — turns a scanned/emailed PDF into structured JSON.
//
// Same constraint as lib/agent/loop.js: farm-budget has no Anthropic SDK
// dependency (node_modules is excluded from the droplet rsync), so this talks
// to /v1/messages over raw fetch. The PDF goes up as a base64 `document`
// block — Claude reads phone photos and text-layer PDFs through the same path,
// which matters because DeLong invoices arrive both ways.

const MODEL = 'claude-opus-5';
const MAX_TOKENS = 16000;

// One tool, forced. The schema is the contract with the rest of the pipeline —
// match.js and the review grid read exactly these field names.
const EXTRACT_TOOL = {
  name: 'record_documents',
  description:
    'Record every distinct document found in the uploaded file. One upload may ' +
    'contain several invoices or a multi-page contract list.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['invoices', 'contracts', 'unreadable'],
    properties: {
      unreadable: {
        type: 'boolean',
        description: 'True if the scan is too poor to read the numbers reliably.'
      },
      invoices: {
        type: 'array',
        description: 'Agronomy / input invoices (products applied to a field).',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'vendor', 'invoiceNumber', 'invoiceDate', 'fieldLabel', 'farmLabel',
            'acres', 'comments', 'ticketNumbers', 'lines',
            'subTotal', 'prepayUsed', 'amountDue', 'confidence'
          ],
          properties: {
            vendor: { type: ['string', 'null'], description: 'e.g. "The DeLong Co., Inc."' },
            invoiceNumber: { type: ['string', 'null'] },
            invoiceDate: { type: ['string', 'null'], description: 'ISO yyyy-mm-dd' },
            fieldLabel: { type: ['string', 'null'], description: 'Field ID exactly as printed' },
            farmLabel: { type: ['string', 'null'], description: 'Farm ID exactly as printed' },
            acres: { type: ['number', 'null'] },
            comments: { type: ['string', 'null'], description: 'Comments line, e.g. "Pre Beans" — names the pass' },
            ticketNumbers: { type: 'array', items: { type: 'string' } },
            subTotal: { type: ['number', 'null'] },
            prepayUsed: { type: ['number', 'null'] },
            amountDue: { type: ['number', 'null'] },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            lines: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['quantity', 'unit', 'description', 'unitPrice', 'priceUnit', 'total', 'paid'],
                properties: {
                  quantity: { type: ['number', 'null'] },
                  unit: { type: ['string', 'null'], description: 'Lbs / Gal / Acre / Ton as printed' },
                  description: { type: 'string', description: 'Product text verbatim, including pack size' },
                  unitPrice: { type: ['number', 'null'] },
                  priceUnit: { type: ['string', 'null'], description: 'the unit after the slash in "51.00 /Lbs"' },
                  total: { type: ['number', 'null'] },
                  paid: { type: 'boolean', description: 'the "Paid" flag at the end of the line' }
                }
              }
            }
          }
        }
      },
      contracts: {
        type: 'array',
        description: 'Grain sale contracts / contract-list rows.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'contractNumber', 'buyer', 'commodity', 'quantity', 'quantityUnit',
            'instrument', 'futuresPrice', 'futuresMonth', 'basis', 'cashPrice',
            'contractDate', 'deliveryStart', 'deliveryEnd', 'destination',
            'cropYear', 'premiums', 'notes', 'confidence'
          ],
          properties: {
            contractNumber: { type: ['string', 'null'] },
            buyer: { type: ['string', 'null'] },
            commodity: { type: ['string', 'null'], description: 'Commodity exactly as papered, e.g. "NON GMO FOOD BEANS"' },
            quantity: { type: ['number', 'null'] },
            quantityUnit: { type: ['string', 'null'], description: 'bu / lbs / ton / acre' },
            instrument: {
              type: ['string', 'null'],
              enum: ['PRICED', 'HTA', 'FUTURES_FIXED', 'BASIS_FIXED', 'ACCUMULATOR', 'SPOT', 'MIN_PRICE', null],
              description: 'FUTURES ONLY / HTA on the paper means the basis is OPEN — do not invent one.'
            },
            futuresPrice: { type: ['number', 'null'] },
            futuresMonth: { type: ['string', 'null'], description: 'e.g. CZ26, SX26' },
            basis: { type: ['number', 'null'], description: 'null when the contract leaves basis open' },
            cashPrice: { type: ['number', 'null'], description: 'flat/delivered price when the paper states one' },
            contractDate: { type: ['string', 'null'], description: 'ISO yyyy-mm-dd' },
            deliveryStart: { type: ['string', 'null'], description: 'ISO yyyy-mm-dd' },
            deliveryEnd: { type: ['string', 'null'], description: 'ISO yyyy-mm-dd' },
            destination: { type: ['string', 'null'], description: 'delivery point / branch as printed' },
            cropYear: { type: ['integer', 'null'] },
            premiums: {
              type: 'array',
              description: 'Stated premiums and fees, e.g. +2.15 grower agreement, -.05 service fee',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['label', 'amount'],
                properties: {
                  label: { type: 'string' },
                  amount: { type: ['number', 'null'] }
                }
              }
            },
            notes: { type: ['string', 'null'], description: 'anything on the paper that changes the meaning' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
          }
        }
      }
    }
  }
};

const SYSTEM = [
  'You transcribe farm paperwork for W. Hughes Farms. The output is applied to',
  'financial and regulatory records, so transcription accuracy outranks',
  'helpfulness.',
  '',
  'Rules:',
  '- Copy numbers exactly as printed. Never compute a number that is not on the',
  '  page, never round, never "fix" one that looks wrong.',
  '- Copy product and commodity descriptions VERBATIM, including pack sizes like',
  '  "(2x7.5 Lb)" and "(265 Gal)". Downstream matching depends on the raw text.',
  '- A value you cannot read is null. Guessing is worse than a gap — a null gets',
  '  asked about, a wrong number gets filed.',
  '- On a grain contract, "FUTURES ONLY" / "HTA" means the basis is still open:',
  '  leave basis null. Do not derive a basis from a cash price.',
  '- Dates become ISO yyyy-mm-dd. A two-digit year on farm paperwork is 20xx.',
  '- Set confidence "low" on any document where the scan forced you to squint at',
  '  a digit.',
  '',
  'Call record_documents exactly once with everything you found.'
].join('\n');

// POST one PDF (or image) and get the structured documents back.
// `media` is { base64, mediaType, filename }.
async function extractDocuments(apiKey, media) {
  const isPdf = media.mediaType === 'application/pdf';
  const block = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: media.base64 } }
    : { type: 'image', source: { type: 'base64', media_type: media.mediaType, data: media.base64 } };

  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system: SYSTEM,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'record_documents' },
    messages: [{
      role: 'user',
      content: [
        block,
        {
          type: 'text',
          text:
            'Transcribe every document in this file (' + (media.filename || 'upload') + ').\n' +
            'Agronomy invoices go in `invoices`; grain sale contracts go in `contracts`. ' +
            'A file that holds several invoices produces several entries.'
        }
      ]
    }]
  };

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const detail = await resp.text();
    const err = new Error('Claude API ' + resp.status);
    err.detail = detail.slice(0, 400);
    throw err;
  }

  const msg = await resp.json();

  if (msg.stop_reason === 'refusal') {
    const err = new Error('Extraction declined');
    err.detail = (msg.stop_details && msg.stop_details.explanation) || '';
    throw err;
  }
  if (msg.stop_reason === 'max_tokens') {
    const err = new Error('Document too long to transcribe in one pass');
    err.detail = 'Split the upload into fewer pages and retry.';
    throw err;
  }

  const call = (msg.content || []).find(function (b) {
    return b.type === 'tool_use' && b.name === 'record_documents';
  });
  if (!call) {
    const err = new Error('No structured output returned');
    err.detail = (msg.content || []).map(function (b) { return b.type; }).join(',');
    throw err;
  }

  // Tool inputs are already parsed JSON from the SDK-less path, but the block
  // shape is the API's — never string-match it.
  const out = call.input || {};
  return {
    invoices: Array.isArray(out.invoices) ? out.invoices : [],
    contracts: Array.isArray(out.contracts) ? out.contracts : [],
    unreadable: !!out.unreadable,
    usage: msg.usage || null
  };
}

module.exports = { extractDocuments, MODEL };
