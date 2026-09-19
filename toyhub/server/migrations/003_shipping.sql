-- What the piece ships as, which is what a carrier actually bills on. Sizes are
-- the packed box in centimetres and the weight is in grams; all zero means the
-- piece has not been measured yet and carriage falls back to a flat rate.
ALTER TABLE products ADD COLUMN IF NOT EXISTS box_w_cm INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS box_l_cm INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS box_h_cm INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_g INTEGER NOT NULL DEFAULT 0;
