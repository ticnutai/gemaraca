-- Allow deleting psakei_din (needed for cleanup)
CREATE POLICY "Allow delete psakei din" 
ON public.psakei_din 
FOR DELETE 
USING (true);

-- Allow deleting sugya_psak_links (needed for cleanup)
CREATE POLICY "Allow delete sugya psak links" 
ON public.sugya_psak_links 
FOR DELETE 
USING (true);

-- Allow updating psakei_din (needed for AI analysis)
CREATE POLICY "Allow update psakei din" 
ON public.psakei_din 
FOR UPDATE 
USING (true);