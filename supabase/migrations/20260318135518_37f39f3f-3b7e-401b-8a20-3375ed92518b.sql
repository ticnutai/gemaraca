
-- ===== psakei_din =====
DROP POLICY IF EXISTS "Allow insert to psakei din" ON public.psakei_din;
DROP POLICY IF EXISTS "Allow delete psakei din" ON public.psakei_din;
DROP POLICY IF EXISTS "Allow update psakei din" ON public.psakei_din;

CREATE POLICY "Authenticated users can insert psakei din" ON public.psakei_din
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update psakei din" ON public.psakei_din
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete psakei din" ON public.psakei_din
  FOR DELETE TO authenticated USING (true);

-- ===== smart_index_results =====
DROP POLICY IF EXISTS "Anyone can insert smart index results" ON public.smart_index_results;
DROP POLICY IF EXISTS "Anyone can update smart index results" ON public.smart_index_results;
DROP POLICY IF EXISTS "Anyone can delete smart index results" ON public.smart_index_results;

CREATE POLICY "Authenticated users can insert smart index results" ON public.smart_index_results
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update smart index results" ON public.smart_index_results
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete smart index results" ON public.smart_index_results
  FOR DELETE TO authenticated USING (true);

-- ===== pattern_sugya_links =====
DROP POLICY IF EXISTS "Anyone can insert pattern sugya links" ON public.pattern_sugya_links;
DROP POLICY IF EXISTS "Anyone can delete pattern sugya links" ON public.pattern_sugya_links;

CREATE POLICY "Authenticated users can insert pattern sugya links" ON public.pattern_sugya_links
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update pattern sugya links" ON public.pattern_sugya_links
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete pattern sugya links" ON public.pattern_sugya_links
  FOR DELETE TO authenticated USING (true);

-- ===== sugya_psak_links =====
DROP POLICY IF EXISTS "Allow insert to sugya psak links" ON public.sugya_psak_links;
DROP POLICY IF EXISTS "Allow delete sugya psak links" ON public.sugya_psak_links;

CREATE POLICY "Authenticated users can insert sugya psak links" ON public.sugya_psak_links
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update sugya psak links" ON public.sugya_psak_links
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete sugya psak links" ON public.sugya_psak_links
  FOR DELETE TO authenticated USING (true);

-- ===== modern_examples =====
DROP POLICY IF EXISTS "Anyone can insert modern examples" ON public.modern_examples;
DROP POLICY IF EXISTS "Anyone can update modern examples" ON public.modern_examples;

CREATE POLICY "Authenticated users can insert modern examples" ON public.modern_examples
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update modern examples" ON public.modern_examples
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete modern examples" ON public.modern_examples
  FOR DELETE TO authenticated USING (true);

-- ===== text_annotations =====
DROP POLICY IF EXISTS "Anyone can insert text annotations" ON public.text_annotations;
DROP POLICY IF EXISTS "Anyone can update text annotations" ON public.text_annotations;
DROP POLICY IF EXISTS "Anyone can delete text annotations" ON public.text_annotations;

CREATE POLICY "Authenticated users can insert text annotations" ON public.text_annotations
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update text annotations" ON public.text_annotations
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete text annotations" ON public.text_annotations
  FOR DELETE TO authenticated USING (true);
