-- Table to store extracted Talmud references from psakei_din
CREATE TABLE public.talmud_references (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  psak_din_id uuid NOT NULL REFERENCES public.psakei_din(id) ON DELETE CASCADE,
  tractate text NOT NULL,
  daf text NOT NULL,
  amud text, -- 'a' or 'b' or null if unknown
  raw_reference text NOT NULL, -- the original text as found in the document
  normalized text NOT NULL, -- normalized form e.g. "קידושין ג."
  confidence text NOT NULL DEFAULT 'medium', -- high/medium/low
  source text NOT NULL DEFAULT 'regex', -- 'regex', 'ai', 'manual'
  context_snippet text, -- surrounding text for verification
  validation_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid
);

-- Enable RLS
ALTER TABLE public.talmud_references ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view references"
  ON public.talmud_references FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert references"
  ON public.talmud_references FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update references"
  ON public.talmud_references FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete references"
  ON public.talmud_references FOR DELETE TO authenticated USING (true);

-- Indexes for fast lookups
CREATE INDEX idx_talmud_refs_psak ON public.talmud_references(psak_din_id);
CREATE INDEX idx_talmud_refs_tractate ON public.talmud_references(tractate);
CREATE INDEX idx_talmud_refs_normalized ON public.talmud_references(normalized);
CREATE INDEX idx_talmud_refs_status ON public.talmud_references(validation_status);

-- Validation status constraint trigger
CREATE OR REPLACE FUNCTION public.validate_talmud_ref_status_v2()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.validation_status NOT IN ('pending', 'correct', 'incorrect', 'ignored') THEN
    RAISE EXCEPTION 'validation_status must be pending, correct, incorrect, or ignored';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_talmud_ref_status_v2_trigger
BEFORE INSERT OR UPDATE ON public.talmud_references
FOR EACH ROW
EXECUTE FUNCTION public.validate_talmud_ref_status_v2();
