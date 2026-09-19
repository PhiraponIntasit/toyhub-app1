-- Settling what a pre-order still owes once the piece arrives.
--
-- 'Balance due' sits between Producing and Ready to ship: the shop has the
-- piece in hand and has asked the customer for the rest.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('Confirmed', 'Producing', 'Balance due', 'Ready to ship', 'Completed', 'Cancelled'));

-- Carriage is not charged on a deposit, because a piece a year out would be
-- quoted at today's rates. It is worked out when the balance is requested and
-- kept here, so the figure the customer was shown is the figure they pay.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS balance_shipping INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS balance_requested_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS balance_paid_at TIMESTAMPTZ;
-- Separate from payment_intent_id, which belongs to the deposit.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS balance_intent_id TEXT NOT NULL DEFAULT '';

-- Two more letters the shop sends: the request, and the receipt for it.
ALTER TABLE email_log DROP CONSTRAINT IF EXISTS email_log_kind_check;
ALTER TABLE email_log ADD CONSTRAINT email_log_kind_check
  CHECK (kind IN ('confirmation', 'balance', 'balance-paid', 'tracking'));
