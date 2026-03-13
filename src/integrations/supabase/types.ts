export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      faq_items: {
        Row: {
          answer: string
          created_at: string
          id: string
          order_index: number | null
          psak_din_id: string
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          order_index?: number | null
          psak_din_id: string
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          order_index?: number | null
          psak_din_id?: string
          question?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faq_items_psak_din_id_fkey"
            columns: ["psak_din_id"]
            isOneToOne: false
            referencedRelation: "psakei_din"
            referencedColumns: ["id"]
          },
        ]
      }
      gemara_pages: {
        Row: {
          created_at: string
          daf_number: number
          daf_yomi: string
          id: string
          masechet: string
          sefaria_ref: string
          sugya_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daf_number: number
          daf_yomi: string
          id?: string
          masechet?: string
          sefaria_ref: string
          sugya_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daf_number?: number
          daf_yomi?: string
          id?: string
          masechet?: string
          sefaria_ref?: string
          sugya_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      migration_history: {
        Row: {
          created_at: string
          description: string | null
          error_message: string | null
          executed_at: string | null
          executed_by: string | null
          execution_time_ms: number | null
          id: string
          name: string
          rows_affected: number | null
          source: string
          source_url: string | null
          sql_content: string
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          error_message?: string | null
          executed_at?: string | null
          executed_by?: string | null
          execution_time_ms?: number | null
          id?: string
          name: string
          rows_affected?: number | null
          source?: string
          source_url?: string | null
          sql_content: string
          status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          error_message?: string | null
          executed_at?: string | null
          executed_by?: string | null
          execution_time_ms?: number | null
          id?: string
          name?: string
          rows_affected?: number | null
          source?: string
          source_url?: string | null
          sql_content?: string
          status?: string
        }
        Relationships: []
      }
      modern_examples: {
        Row: {
          created_at: string
          daf_yomi: string
          examples: Json
          id: string
          masechet: string
          practical_summary: string
          principle: string
          sugya_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daf_yomi: string
          examples?: Json
          id?: string
          masechet: string
          practical_summary: string
          principle: string
          sugya_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daf_yomi?: string
          examples?: Json
          id?: string
          masechet?: string
          practical_summary?: string
          principle?: string
          sugya_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      pattern_sugya_links: {
        Row: {
          amud: string | null
          confidence: string
          created_at: string
          daf: string | null
          id: string
          masechet: string
          psak_din_id: string
          source_text: string
          sugya_id: string
        }
        Insert: {
          amud?: string | null
          confidence?: string
          created_at?: string
          daf?: string | null
          id?: string
          masechet: string
          psak_din_id: string
          source_text: string
          sugya_id: string
        }
        Update: {
          amud?: string | null
          confidence?: string
          created_at?: string
          daf?: string | null
          id?: string
          masechet?: string
          psak_din_id?: string
          source_text?: string
          sugya_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pattern_sugya_links_psak_din_id_fkey"
            columns: ["psak_din_id"]
            isOneToOne: false
            referencedRelation: "psakei_din"
            referencedColumns: ["id"]
          },
        ]
      }
      psakei_din: {
        Row: {
          case_number: string | null
          content_hash: string | null
          court: string
          created_at: string
          full_text: string | null
          id: string
          source_url: string | null
          summary: string
          tags: string[] | null
          title: string
          updated_at: string
          year: number
        }
        Insert: {
          case_number?: string | null
          content_hash?: string | null
          court: string
          created_at?: string
          full_text?: string | null
          id?: string
          source_url?: string | null
          summary: string
          tags?: string[] | null
          title: string
          updated_at?: string
          year: number
        }
        Update: {
          case_number?: string | null
          content_hash?: string | null
          court?: string
          created_at?: string
          full_text?: string | null
          id?: string
          source_url?: string | null
          summary?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      smart_index_results: {
        Row: {
          analysis_method: string
          books: string[]
          created_at: string
          has_full_text: boolean
          id: string
          masechtot: string[]
          psak_din_id: string
          sources: Json
          topics: Json
          updated_at: string
          word_count: number
        }
        Insert: {
          analysis_method?: string
          books?: string[]
          created_at?: string
          has_full_text?: boolean
          id?: string
          masechtot?: string[]
          psak_din_id: string
          sources?: Json
          topics?: Json
          updated_at?: string
          word_count?: number
        }
        Update: {
          analysis_method?: string
          books?: string[]
          created_at?: string
          has_full_text?: boolean
          id?: string
          masechtot?: string[]
          psak_din_id?: string
          sources?: Json
          topics?: Json
          updated_at?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "smart_index_results_psak_din_id_fkey"
            columns: ["psak_din_id"]
            isOneToOne: true
            referencedRelation: "psakei_din"
            referencedColumns: ["id"]
          },
        ]
      }
      talmud_references: {
        Row: {
          id: string
          psak_din_id: string
          tractate: string
          daf: string
          amud: string | null
          raw_reference: string
          normalized: string
          confidence: string
          source: string
          context_snippet: string | null
          validation_status: string
          created_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          psak_din_id: string
          tractate: string
          daf: string
          amud?: string | null
          raw_reference: string
          normalized: string
          confidence?: string
          source?: string
          context_snippet?: string | null
          validation_status?: string
          created_at?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          psak_din_id?: string
          tractate?: string
          daf?: string
          amud?: string | null
          raw_reference?: string
          normalized?: string
          confidence?: string
          source?: string
          context_snippet?: string | null
          validation_status?: string
          created_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "talmud_references_psak_din_id_fkey"
            columns: ["psak_din_id"]
            isOneToOne: false
            referencedRelation: "psakei_din"
            referencedColumns: ["id"]
          },
        ]
      }
      sugya_psak_links: {
        Row: {
          connection_explanation: string
          created_at: string
          id: string
          psak_din_id: string
          relevance_score: number | null
          sugya_id: string
        }
        Insert: {
          connection_explanation: string
          created_at?: string
          id?: string
          psak_din_id: string
          relevance_score?: number | null
          sugya_id: string
        }
        Update: {
          connection_explanation?: string
          created_at?: string
          id?: string
          psak_din_id?: string
          relevance_score?: number | null
          sugya_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sugya_psak_links_psak_din_id_fkey"
            columns: ["psak_din_id"]
            isOneToOne: false
            referencedRelation: "psakei_din"
            referencedColumns: ["id"]
          },
        ]
      }
      text_annotations: {
        Row: {
          created_at: string
          end_offset: number
          id: string
          original_text: string
          source_id: string
          source_type: string
          start_offset: number
          styles: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_offset: number
          id?: string
          original_text: string
          source_id: string
          source_type: string
          start_offset: number
          styles?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_offset?: number
          id?: string
          original_text?: string
          source_id?: string
          source_type?: string
          start_offset?: number
          styles?: Json
          updated_at?: string
        }
        Relationships: []
      }
      upload_sessions: {
        Row: {
          created_at: string
          current_file: string | null
          device_id: string | null
          failed_files: number
          id: string
          processed_files: number
          session_id: string
          skipped_files: number
          status: string
          successful_files: number
          total_files: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          current_file?: string | null
          device_id?: string | null
          failed_files?: number
          id?: string
          processed_files?: number
          session_id: string
          skipped_files?: number
          status?: string
          successful_files?: number
          total_files?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          current_file?: string | null
          device_id?: string | null
          failed_files?: number
          id?: string
          processed_files?: number
          session_id?: string
          skipped_files?: number
          status?: string
          successful_files?: number
          total_files?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      exec_sql: { Args: { query: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
