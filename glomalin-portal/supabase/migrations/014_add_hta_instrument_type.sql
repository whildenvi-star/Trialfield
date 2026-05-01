-- Add HTA (Hedge-To-Arrive) as a valid instrument type.
-- HTA: futures price locked at signing, basis set at delivery.
-- Reuses existing columns: bushels, futures_reference (locked price),
-- basis (null = open, positive = premium), delivery_start/end, buyer, contract_number.

ALTER TABLE sale_instruments
  DROP CONSTRAINT IF EXISTS sale_instruments_instrument_type_check;

ALTER TABLE sale_instruments
  ADD CONSTRAINT sale_instruments_instrument_type_check
  CHECK (instrument_type IN ('cash', 'forward_contract', 'option', 'accumulator', 'hta'));
