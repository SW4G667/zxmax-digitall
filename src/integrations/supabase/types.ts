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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      bans: {
        Row: {
          active: boolean
          banned_by: string
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          active?: boolean
          banned_by: string
          created_at?: string
          id?: string
          reason?: string
          user_id: string
        }
        Update: {
          active?: boolean
          banned_by?: string
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      global_notices: {
        Row: {
          created_at: string
          created_by: string
          id: string
          text: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          text: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          text?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          approved: boolean
          banner: string | null
          category: string
          created_at: string
          delivery_content: string | null
          delivery_type: string
          description: string
          id: number
          image: string
          name: string
          price: number
          questions: Json
          rating: number
          sales: number
          seller_email: string
          seller_id: string
          seller_name: string
          seller_public_id: string
          updated_at: string
          variations: Json
        }
        Insert: {
          approved?: boolean
          banner?: string | null
          category?: string
          created_at?: string
          delivery_content?: string | null
          delivery_type?: string
          description?: string
          id?: number
          image?: string
          name: string
          price?: number
          questions?: Json
          rating?: number
          sales?: number
          seller_email?: string
          seller_id: string
          seller_name?: string
          seller_public_id?: string
          updated_at?: string
          variations?: Json
        }
        Update: {
          approved?: boolean
          banner?: string | null
          category?: string
          created_at?: string
          delivery_content?: string | null
          delivery_type?: string
          description?: string
          id?: number
          image?: string
          name?: string
          price?: number
          questions?: Json
          rating?: number
          sales?: number
          seller_email?: string
          seller_id?: string
          seller_name?: string
          seller_public_id?: string
          updated_at?: string
          variations?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          document_type: string | null
          email: string
          id: string
          is_verified_seller: boolean
          pix_key: string | null
          public_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          document_type?: string | null
          email: string
          id?: string
          is_verified_seller?: boolean
          pix_key?: string | null
          public_id?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          document_type?: string | null
          email?: string
          id?: string
          is_verified_seller?: boolean
          pix_key?: string | null
          public_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number
          buyer_email: string
          buyer_id: string
          buyer_public_id: string
          created_at: string
          id: number
          messages: Json
          product_id: number
          review_comment: string | null
          review_stars: number | null
          reviewed: boolean
          seller_email: string
          seller_id: string
          seller_public_id: string
          status: string
          updated_at: string
          variation_name: string | null
        }
        Insert: {
          amount?: number
          buyer_email?: string
          buyer_id: string
          buyer_public_id?: string
          created_at?: string
          id?: number
          messages?: Json
          product_id: number
          review_comment?: string | null
          review_stars?: number | null
          reviewed?: boolean
          seller_email?: string
          seller_id: string
          seller_public_id?: string
          status?: string
          updated_at?: string
          variation_name?: string | null
        }
        Update: {
          amount?: number
          buyer_email?: string
          buyer_id?: string
          buyer_public_id?: string
          created_at?: string
          id?: number
          messages?: Json
          product_id?: number
          review_comment?: string | null
          review_stars?: number | null
          reviewed?: boolean
          seller_email?: string
          seller_id?: string
          seller_public_id?: string
          status?: string
          updated_at?: string
          variation_name?: string | null
        }
        Relationships: []
      }
      seller_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_path: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_path: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_path?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      team_chat: {
        Row: {
          created_at: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_tag_assignments: {
        Row: {
          id: string
          tag_id: string
          user_id: string
        }
        Insert: {
          id?: string
          tag_id: string
          user_id: string
        }
        Update: {
          id?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "user_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          created_at: string
          id: number
          method: string
          pix_key: string
          status: string
          updated_at: string
          user_email: string
          user_id: string
          user_public_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: number
          method?: string
          pix_key?: string
          status?: string
          updated_at?: string
          user_email?: string
          user_id: string
          user_public_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: number
          method?: string
          pix_key?: string
          status?: string
          updated_at?: string
          user_email?: string
          user_id?: string
          user_public_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_banned: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "support" | "user"
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
      app_role: ["admin", "support", "user"],
    },
  },
} as const
