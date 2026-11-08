-- Richer place content: localized long descriptions with their source (e.g. Wikipedia, CC BY-SA).
ALTER TABLE places
  ADD COLUMN description_i18n jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN about_source jsonb;
