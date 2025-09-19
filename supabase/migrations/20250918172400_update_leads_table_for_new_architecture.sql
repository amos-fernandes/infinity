-- Update leads table for new B2B prospecting architecture
-- Add columns for real data collection and LLM qualification

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS cnpj TEXT,
ADD COLUMN IF NOT EXISTS qualification_score TEXT,
ADD COLUMN IF NOT EXISTS urgency_level TEXT,
ADD COLUMN IF NOT EXISTS approach_strategy TEXT,
ADD COLUMN IF NOT EXISTS contact_channels JSONB,
ADD COLUMN IF NOT EXISTS raw_data JSONB;

-- Make some old columns nullable since we're changing the data structure
ALTER TABLE public.leads
ALTER COLUMN empresa DROP NOT NULL,
ALTER COLUMN contato_decisor DROP NOT NULL;