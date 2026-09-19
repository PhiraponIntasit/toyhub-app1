-- Free text the shop writes about a piece — what is in the box, materials,
-- anything the short description has no room for. Shown on the product page
-- under "What's Included" and nowhere else.
ALTER TABLE products ADD COLUMN IF NOT EXISTS details TEXT NOT NULL DEFAULT '';
