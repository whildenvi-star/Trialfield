'use strict';

// Tool definitions and implementations for the MACRO chat agent.
//
// Every financial number the model quotes comes from here, computed from Calc
// at answer time — no pre-stuffed context blob, no stale snapshot, one audited
// path for units. Ranking and arithmetic happen in JS, not in the model's head.
//
// Role gating is enforced twice on purpose: a role only SEES the tools it may
// use (toolsForRole), and every financial tool re-checks the role when it runs
// (executeTool). The second check is what holds if a prompt injection talks the
// model into naming a tool it was never offered.

const Calc = require('../../public/calc.js');

const FULL = ['admin', 'agronomist'];
const isFull = (role) => FULL.indexOf(role) !== -1;

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------
const DEFS = {
  list_enterprises: {
    roles: ['admin', 'agronomist', 'office', 'operator'],
    def: {
      name: 'list_enterprises',
      description: 'List every enterprise with its acreage and crops. No financial data. Use this to learn what enterprises exist before asking for detail.',
      input_schema: { type: 'object', properties: {}, required: [] }
    }
  },

  get_enterprise_summary: {
    roles: FULL,
    def: {
      name: 'get_enterprise_summary',
      description: 'Full financial summary for one or all enterprises: acres, rent, expenses, crop income, profit, and cost of production. Every dollar figure is returned BOTH as a whole-enterprise total and per acre — the field names say which is which. Use the per-acre fields for any comparison between enterprises of different size. NOTE: expenses already INCLUDE rent — never add rent to expenses.',
      input_schema: {
        type: 'object',
        properties: {
          enterprise: { type: 'string', description: 'Enterprise short name (partial, case-insensitive). Omit for all enterprises.' }
        },
        required: []
      }
    }
  },

  compare_enterprises: {
    roles: FULL,
    def: {
      name: 'compare_enterprises',
      description: 'Rank all enterprises by one metric, sorted best-to-worst server-side. Use this instead of sorting numbers yourself — the ranking returned is authoritative.',
      input_schema: {
        type: 'object',
        properties: {
          metric: {
            type: 'string',
            enum: ['profit_per_acre', 'profit_with_payments_per_acre', 'expense_per_acre', 'cop', 'total_profit', 'acres'],
            description: 'Metric to rank by. profit_per_acre is the default measure of farming performance; cop is cost of production per bushel (lower is better).'
          }
        },
        required: ['metric']
      }
    }
  },

  get_crop_summary: {
    roles: ['admin', 'agronomist', 'office'],
    def: {
      name: 'get_crop_summary',
      description: 'Per-crop rows within each enterprise: acres, projected yield per acre, and (financial roles only) profit per acre and cost of production per bushel.',
      input_schema: {
        type: 'object',
        properties: {
          crop: { type: 'string', description: 'Filter by crop name (partial, case-insensitive).' },
          enterprise: { type: 'string', description: 'Filter by enterprise short name (partial, case-insensitive).' }
        },
        required: []
      }
    }
  },

  list_fields: {
    roles: ['admin', 'agronomist', 'office', 'operator'],
    def: {
      name: 'list_fields',
      description: 'List fields with name, enterprise, acres, and crop. No financial data.',
      input_schema: {
        type: 'object',
        properties: {
          enterprise: { type: 'string', description: 'Filter by enterprise short name (partial, case-insensitive).' },
          crop: { type: 'string', description: 'Filter by crop (partial, case-insensitive).' },
          name: { type: 'string', description: 'Filter by field name (partial, case-insensitive).' }
        },
        required: []
      }
    }
  },

  get_field_budget: {
    roles: FULL,
    def: {
      name: 'get_field_budget',
      description: 'Per-acre cost and profit breakdown for matching fields: rent, fertilizer, seed, machinery, expenses, projected yield, and profit. All figures are per acre unless the field name ends in _total. NOTE: expense_per_acre already INCLUDES rent, fertilizer, seed, and machinery — those are its components, not additions to it.',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Field name (partial, case-insensitive).' },
          enterprise: { type: 'string', description: 'Filter by enterprise short name (partial, case-insensitive).' },
          crop: { type: 'string', description: 'Filter by crop (partial, case-insensitive).' },
          worst: { type: 'integer', description: 'Instead of filtering, return the N least profitable fields per acre.' },
          limit: { type: 'integer', description: 'Max fields to return (default 25).' }
        },
        required: []
      }
    }
  },

  get_settings: {
    roles: FULL,
    def: {
      name: 'get_settings',
      description: 'Planning assumptions behind every budget: crop year, fuel price, machinery rate, wage rate, carry months.',
      input_schema: { type: 'object', properties: {}, required: [] }
    }
  },

  get_sales_contracts: {
    roles: ['admin', 'agronomist', 'office'],
    def: {
      name: 'get_sales_contracts',
      description: 'Sales contracts by buyer with crop and bushels. Contract prices are included only for financial roles.',
      input_schema: { type: 'object', properties: {}, required: [] }
    }
  },

  get_futures: {
    roles: ['admin', 'agronomist', 'office'],
    def: {
      name: 'get_futures',
      description: 'Current CBOT futures with the timestamp they were fetched. Quotes can be up to 15 minutes old — cite the timestamp when it matters.',
      input_schema: { type: 'object', properties: {}, required: [] }
    }
  },

  get_audit_alerts: {
    roles: ['admin', 'agronomist', 'office', 'operator'],
    def: {
      name: 'get_audit_alerts',
      description: 'Unresolved data-quality alerts from the nightly audit. Check these when a number looks wrong or a user asks why something is off.',
      input_schema: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['error', 'warning', 'info'], description: 'Filter by severity.' },
          limit: { type: 'integer', description: 'Max alerts (default 20).' }
        },
        required: []
      }
    }
  },

  get_network_status: {
    roles: ['admin', 'agronomist', 'office', 'operator'],
    def: {
      name: 'get_network_status',
      description: 'Live query to the sibling Glomalin services (farm registry, grain tickets, FSA acres). Each returns either its data or an explicit unavailable flag. Grain tickets is the source of truth for ACTUAL loads hauled — budget figures are projections, so use this when the user asks what really happened.',
      input_schema: { type: 'object', properties: {}, required: [] }
    }
  }
};

function toolsForRole(role) {
  return Object.keys(DEFS)
    .filter((k) => DEFS[k].roles.indexOf(role) !== -1)
    .map((k) => DEFS[k].def);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const money = (n) => Math.round((n || 0) * 100) / 100;
const matches = (hay, needle) => !needle || String(hay || '').toLowerCase().indexOf(String(needle).toLowerCase()) !== -1;

// computeDashboard walks every field; memoize per request so a 4-tool turn
// doesn't recompute it four times.
function dashboardOf(ctx) {
  if (!ctx._dash) {
    ctx._dash = Calc.computeDashboard(
      ctx.store.fields, ctx.store.enterprises, ctx.getRefs(), ctx.store.settings, { yieldMode: 'projected' }
    );
  }
  return ctx._dash;
}

function enterpriseRows(ctx) {
  return (dashboardOf(ctx).enterpriseSummaries || []).map((s) => {
    const t = s.totals || {};
    const acres = t.acres || 0;
    const perAcre = (v) => (acres > 0 ? money(v / acres) : 0);
    return {
      enterprise: s.enterprise.shortName,
      acres: money(acres),
      rent_total: money(t.rent),
      rent_per_acre: perAcre(t.rent),
      expenses_total: money(t.expTotal),
      expense_per_acre: t.avgExpPerAcre != null ? money(t.avgExpPerAcre) : perAcre(t.expTotal),
      crop_income_total: money(t.cropIncome),
      income_per_acre: perAcre(t.cropIncome),
      gov_payments_total: money(t.govPayments),
      profit_total: money(t.cropProfit),
      profit_per_acre: t.avgProfitPerAcre != null ? money(t.avgProfitPerAcre) : perAcre(t.cropProfit),
      profit_with_payments_total: money(t.profitWithPayments),
      profit_with_payments_per_acre: perAcre(t.profitWithPayments),
      cop_per_bushel: money(t.cop)
    };
  });
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------
async function executeTool(name, input, ctx, role) {
  const spec = DEFS[name];
  if (!spec) return { error: 'Unknown tool: ' + name };
  // Second gate — holds even if the model was talked into naming this tool.
  if (spec.roles.indexOf(role) === -1) {
    return { error: 'Not available for this role. Say plainly that this data is not in your view.' };
  }
  input = input || {};

  switch (name) {
    case 'list_enterprises': {
      const crops = {};
      ctx.store.fields.forEach((f) => {
        const id = Calc.resolveEnterpriseId(f, ctx.store.cropTypes || [], ctx.store.enterprises);
        if (!crops[id]) crops[id] = {};
        if (f.crop) crops[id][f.crop] = true;
      });
      return {
        enterprises: (dashboardOf(ctx).enterpriseSummaries || []).map((s) => ({
          enterprise: s.enterprise.shortName,
          acres: money(s.totals.acres),
          crops: Object.keys(crops[s.enterprise.id] || {}).sort()
        }))
      };
    }

    case 'get_enterprise_summary': {
      const rows = enterpriseRows(ctx).filter((r) => matches(r.enterprise, input.enterprise));
      if (!rows.length) return { error: 'No enterprise matched "' + (input.enterprise || '') + '".', available: enterpriseRows(ctx).map((r) => r.enterprise) };
      return { basis: 'projected yields, crop year ' + (ctx.store.settings.year || ctx.getCropYear()), enterprises: rows };
    }

    case 'compare_enterprises': {
      const key = {
        profit_per_acre: 'profit_per_acre',
        profit_with_payments_per_acre: 'profit_with_payments_per_acre',
        expense_per_acre: 'expense_per_acre',
        cop: 'cop_per_bushel',
        total_profit: 'profit_total',
        acres: 'acres'
      }[input.metric];
      if (!key) return { error: 'Unknown metric: ' + input.metric };
      // Lower is better for costs; higher is better for everything else.
      const ascending = (key === 'expense_per_acre' || key === 'cop_per_bushel');
      const ranked = enterpriseRows(ctx)
        .slice()
        .sort((a, b) => (ascending ? a[key] - b[key] : b[key] - a[key]))
        .map((r, i) => ({ rank: i + 1, enterprise: r.enterprise, acres: r.acres, value: r[key] }));
      return {
        metric: input.metric,
        unit: key.indexOf('per_acre') !== -1 ? '$/ac' : (key === 'cop_per_bushel' ? '$/bu' : (key === 'acres' ? 'acres' : '$ total')),
        order: ascending ? 'lowest (best) first' : 'highest (best) first',
        basis: 'projected yields',
        ranking: ranked
      };
    }

    case 'get_crop_summary': {
      const dash = dashboardOf(ctx);
      const rows = [];
      ['conventional', 'organic'].forEach((cat) => {
        (dash[cat] || []).forEach((eg) => {
          (eg.cropRows || []).forEach((r) => {
            if (!matches(eg.enterprise.shortName, input.enterprise) || !matches(r.crop, input.crop)) return;
            const row = {
              enterprise: eg.enterprise.shortName,
              crop: r.crop,
              acres: money(r.acres),
              projected_yield_per_acre: r.avgYield,
              yield_unit: r.unit || 'bu'
            };
            if (isFull(role)) {
              row.profit_per_acre = money(r.profitPerAcre);
              row.cop_per_bushel = money(r.cop);
            }
            rows.push(row);
          });
        });
      });
      return { basis: 'projected yields', crops: rows };
    }

    case 'list_fields': {
      const rows = ctx.store.fields.map((f) => {
        const id = Calc.resolveEnterpriseId(f, ctx.store.cropTypes || [], ctx.store.enterprises);
        const ent = ctx.store.enterprises.find((e) => e.id === id);
        return { field: f.name, enterprise: ent ? ent.shortName : 'unassigned', acres: f.acres || 0, crop: f.crop || 'none' };
      }).filter((r) => matches(r.enterprise, input.enterprise) && matches(r.crop, input.crop) && matches(r.field, input.name));
      return { count: rows.length, fields: rows };
    }

    case 'get_field_budget': {
      const refs = ctx.getRefs();
      let rows = ctx.store.fields.map((f) => {
        const id = Calc.resolveEnterpriseId(f, ctx.store.cropTypes || [], ctx.store.enterprises);
        const ent = ctx.store.enterprises.find((e) => e.id === id);
        const b = Calc.computeFieldBudget(f, refs, ctx.store.settings, { yieldMode: 'projected' });
        return {
          field: f.name,
          enterprise: ent ? ent.shortName : 'unassigned',
          acres: f.acres || 0,
          crop: f.crop || 'none',
          rent_per_acre: money(f.rentPerAcre),
          fertilizer_per_acre: money(b.totalFertPerAcre),
          seed_per_acre: money(b.seedCostPerAcre),
          machinery_per_acre: money(b.machineryPerAcre),
          expense_per_acre: money(b.expPerAcre),
          projected_yield_per_acre: b.yieldPerAcre || 0,
          yield_unit: b.yieldUnit || 'bu',
          profit_per_acre: money(b.profitPerAcre),
          profit_total: money(b.profitFarmWithoutPayments),
          cop_per_bushel: money(b.cop)
        };
      }).filter((r) => matches(r.field, input.name) && matches(r.enterprise, input.enterprise) && matches(r.crop, input.crop));

      if (input.worst) {
        rows = rows.sort((a, b) => a.profit_per_acre - b.profit_per_acre).slice(0, input.worst);
        return { basis: 'projected yields', sorted: 'least profitable per acre first', fields: rows };
      }
      const limit = Math.min(input.limit || 25, 61);
      return { basis: 'projected yields', count: rows.length, returned: Math.min(rows.length, limit), fields: rows.slice(0, limit) };
    }

    case 'get_settings': {
      const s = ctx.store.settings || {};
      return {
        crop_year: s.year, fuel_price_per_gal: s.fuelPrice, machinery_rate_per_acre: s.machineryRate,
        wage_rate_per_hour: s.wageRate, carry_months: s.carryMonths,
        field_count: (ctx.store.fields || []).length, enterprise_count: (ctx.store.enterprises || []).length
      };
    }

    case 'get_sales_contracts': {
      const rows = (ctx.store.sales || []).map((s) => {
        const row = { buyer: s.buyer || s.buyerName || 'unknown', crop: s.crop || '', bushels: s.bushels || s.quantity || 0 };
        if (isFull(role)) row.price_per_bushel = money(s.pricePerBu || s.price);
        return row;
      });
      return { count: rows.length, contracts: rows, buyers: (ctx.store.buyers || []).map((b) => b.name) };
    }

    case 'get_futures': {
      if (!ctx.futuresCache.data) return { available: false, note: 'No futures quotes cached. Say so; do not estimate prices.' };
      return {
        available: true,
        fetched_at: new Date(ctx.futuresCache.ts).toISOString(),
        age_minutes: Math.round((Date.now() - ctx.futuresCache.ts) / 60000),
        quotes: ctx.futuresCache.data.map((f) => (f.error
          ? { label: f.label, available: false }
          : { label: f.label, contract: f.contract, price_per_bushel: f.price, change: f.change, change_pct: f.changePct }))
      };
    }

    case 'get_audit_alerts': {
      const audit = ctx.getLatestAudit();
      if (!audit || !audit.alerts) return { available: false, note: 'No audit results loaded.' };
      const financial = /rent|cost|profit|expense|price|budget|income|margin/i;
      let alerts = audit.alerts.filter((a) => !a.resolved);
      if (!isFull(role)) alerts = alerts.filter((a) => !financial.test(a.message));
      if (input.severity) alerts = alerts.filter((a) => a.severity === input.severity);
      const limit = input.limit || 20;
      return {
        last_run: audit.runAt,
        unresolved_count: alerts.length,
        returned: Math.min(alerts.length, limit),
        alerts: alerts.slice(0, limit).map((a) => ({ severity: a.severity, message: a.message }))
      };
    }

    case 'get_network_status': {
      const queries = [
        { name: 'farm_registry', url: 'http://localhost:3005/api/fields', transform: (d) => (Array.isArray(d) ? {
          registered_fields: d.length,
          total_acres: money(d.reduce((s, f) => s + (f.reportingAcres || 0), 0)),
          organic_acres: money(d.reduce((s, f) => s + (f.organicAcres || 0), 0))
        } : null) },
        { name: 'grain_tickets', url: 'http://localhost:3000/api/stats', transform: (d) => (d ? {
          note: 'ACTUAL loads hauled — not projections',
          total_tickets: d.totalTickets, total_pounds: d.totalWeight ? Math.round(d.totalWeight) : undefined,
          by_crop: d.byCrop
        } : null) },
        { name: 'fsa_acres', url: 'http://localhost:3002/api/rollup/summary-metrics', transform: (d) => (d ? {
          enrolled_acres: d.totalEnrolledAcres, farms: d.totalFarms,
          compliance_rate: d.complianceRate, reporting_progress: d.reportingProgress
        } : null) }
      ];
      const settled = await Promise.all(queries.map(async (q) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        try {
          let url = q.url;
          const headers = {};
          if (process.env.EMBED_TOKEN) {
            url += (url.indexOf('?') !== -1 ? '&' : '?') + 'token=' + encodeURIComponent(process.env.EMBED_TOKEN);
            headers['x-embed-token'] = process.env.EMBED_TOKEN;
          }
          const r = await fetch(url, { signal: ctrl.signal, headers });
          const data = q.transform(await r.json());
          clearTimeout(timer);
          return [q.name, data ? { available: true, data } : { available: false, reason: 'unexpected response shape' }];
        } catch (e) {
          clearTimeout(timer);
          return [q.name, { available: false, reason: e.name === 'AbortError' ? 'timed out (3s)' : 'unreachable' }];
        }
      }));
      const out = { note: 'Any service marked available:false is down right now. Say so — never estimate its numbers.' };
      settled.forEach(([k, v]) => { out[k] = v; });
      return out;
    }

    default:
      return { error: 'Unhandled tool: ' + name };
  }
}

module.exports = { toolsForRole, executeTool };
