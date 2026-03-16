import type { Database } from "@/integrations/supabase/types";

/** Full psakei_din database row */
export type PsakDinRow = Database["public"]["Tables"]["psakei_din"]["Row"];
