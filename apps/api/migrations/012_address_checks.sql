-- Result of checking a venue's address against a geocoder: exists? in the stated city? near the stored point?
-- Kept separately from the address itself; an address that fails is never shown as confirmed.
ALTER TABLE places ADD COLUMN address_check jsonb;
ALTER TABLE events ADD COLUMN address_check jsonb;
CREATE INDEX places_address_unchecked_idx ON places ((address_check IS NULL)) WHERE address IS NOT NULL AND merged_into IS NULL;
