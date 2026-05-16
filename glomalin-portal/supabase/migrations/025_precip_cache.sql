-- Per-field daily precipitation cache.
-- Populated by POST /api/weather/precip/refresh via the Precip.ai API.
-- Server-side only — no RLS needed (no user writes).

CREATE TABLE precip_cache (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_field_id text        NOT NULL,
  date              date        NOT NULL,
  precip_in         numeric(6,3),
  forecast_prob     numeric(5,2),           -- 0–100 probability for future dates, NULL for historical
  lat               double precision,
  lng               double precision,
  fetched_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registry_field_id, date)
);

-- 7-day and 30-day historical totals per field — used by GET /api/weather/precip
CREATE VIEW precip_summary AS
SELECT
  registry_field_id,
  SUM(precip_in) FILTER (WHERE date >= CURRENT_DATE - 7  AND date <= CURRENT_DATE) AS last_7d_in,
  SUM(precip_in) FILTER (WHERE date >= CURRENT_DATE - 30 AND date <= CURRENT_DATE) AS last_30d_in,
  MAX(fetched_at)                                                                   AS last_fetched
FROM precip_cache
GROUP BY registry_field_id;

-- Per-field 7-day forecast rows — used by ForecastView tab
CREATE VIEW precip_forecast AS
SELECT
  registry_field_id,
  date,
  precip_in,
  forecast_prob
FROM precip_cache
WHERE date > CURRENT_DATE
ORDER BY registry_field_id, date;
