export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          display_name: string
          avatar_url: string | null
          balance: number
          earnings: number
          pix_key: string | null
          role: 'user' | 'seller' | 'support' | 'admin'
          is_banned: boolean
          ban_reason: string | null
          banned_at: string | null
          banned_by: string | null
          is_seller: boolean
          seller_approved: boolean
          documents_uploaded: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string
          avatar_url?: string | null
          balance?: number
          earnings?: number
          pix_key?: string | null
          role?: 'user' | 'seller' | 'support' | 'admin'
          is_banned?: boolean
          ban_reason?: string | null
          banned_at?: string | null
          banned_by?: string | null
          is_seller?: boolean
          seller_approved?: boolean
          documents_uploaded?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string
          avatar_url?: string | null
          balance?: number
          earnings?: number
          pix_key?: string | null
          role?: 'user' | 'seller' | 'support' | 'admin'
          is_banned?: boolean
          ban_reason?: string | null
          banned_at?: string | null
          banned_by?: string | null
          is_seller?: boolean
          seller_approved?: boolean
          documents_uploaded?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          seller_id: string
          name: string
          description: string
          category: string
          price: number
          main_image: string | null
          banner_image: string | null
          delivery_type: 'manual' | 'automatic'
          delivery_content: string | null
          variations: Json | null
          status: 'pending' | 'approved' | 'rejected'
          rejection_reason: string | null
          allow_affiliates: boolean
          affiliate_commission: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          seller_id: string
          name: string
          description?: string
          category: string
          price: number
          main_image?: string | null
          banner_image?: string | null
          delivery_type?: 'manual' | 'automatic'
          delivery_content?: string | null
          variations?: Json | null
          status?: 'pending' | 'approved' | 'rejected'
          rejection_reason?: string | null
          allow_affiliates?: boolean
          affiliate_commission?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          seller_id?: string
          name?: string
          description?: string
          category?: string
          price?: number
          main_image?: string | null
          banner_image?: string | null
          delivery_type?: 'manual' | 'automatic'
          delivery_content?: string | null
          variations?: Json | null
          status?: 'pending' | 'approved' | 'rejected'
          rejection_reason?: string | null
          allow_affiliates?: boolean
          affiliate_commission?: number
          created_at?: string
          updated_at?: string
        }
      }
      purchases: {
        Row: {
          id: string
          buyer_id: string
          seller_id: string
          product_id: string
          amount: number
          status: 'pending' | 'paid' | 'delivered' | 'dispute'
          delivery_content: string | null
          affiliate_id: string | null
          affiliate_commission: number
          created_at: string
          updated_at: string
          metadata: Json | null
        }
        Insert: {
          id?: string
          buyer_id: string
          seller_id: string
          product_id: string
          amount: number
          status?: 'pending' | 'paid' | 'delivered' | 'dispute'
          delivery_content?: string | null
          affiliate_id?: string | null
          affiliate_commission?: number
          created_at?: string
          updated_at?: string
          metadata?: Json | null
        }
        Update: {
          id?: string
          buyer_id?: string
          seller_id?: string
          product_id?: string
          amount?: number
          status?: 'pending' | 'paid' | 'delivered' | 'dispute'
          delivery_content?: string | null
          affiliate_id?: string | null
          affiliate_commission?: number
          created_at?: string
          updated_at?: string
          metadata?: Json | null
        }
      }
      reviews: {
        Row: {
          id: string
          product_id: string
          buyer_id: string
          purchase_id: string
          rating: number
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          buyer_id: string
          purchase_id: string
          rating: number
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          buyer_id?: string
          purchase_id?: string
          rating?: number
          comment?: string | null
          created_at?: string
        }
      }
      questions: {
        Row: {
          id: string
          product_id: string
          buyer_id: string
          question: string
          answer: string | null
          answered_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          buyer_id: string
          question: string
          answer?: string | null
          answered_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          buyer_id?: string
          question?: string
          answer?: string | null
          answered_at?: string | null
          created_at?: string
        }
      }
      affiliate_links: {
        Row: {
          id: string
          product_id: string
          affiliate_id: string
          code: string
          clicks: number
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          affiliate_id: string
          code: string
          clicks?: number
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          affiliate_id?: string
          code?: string
          clicks?: number
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          content: string
          data: Json | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          content: string
          data?: Json | null
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          content?: string
          data?: Json | null
          read?: boolean
          created_at?: string
        }
      }
      tickets: {
        Row: {
          id: string
          user_id: string
          subject: string
          status: 'open' | 'closed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subject: string
          status?: 'open' | 'closed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subject?: string
          status?: 'open' | 'closed'
          created_at?: string
          updated_at?: string
        }
      }
      ticket_messages: {
        Row: {
          id: string
          ticket_id: string
          sender_id: string
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          sender_id: string
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          sender_id?: string
          message?: string
          created_at?: string
        }
      }
      purchase_messages: {
        Row: {
          id: string
          purchase_id: string
          sender_id: string
          message: string
          attachment_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          purchase_id: string
          sender_id: string
          message: string
          attachment_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          purchase_id?: string
          sender_id?: string
          message?: string
          attachment_url?: string | null
          created_at?: string
        }
      }
      admin_chat: {
        Row: {
          id: string
          sender_id: string
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          sender_id: string
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          sender_id?: string
          message?: string
          created_at?: string
        }
      }
      withdrawals: {
        Row: {
          id: string
          seller_id: string
          amount: number
          pix_key: string
          status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed'
          type: 'normal' | 'instant'
          fee: number
          created_at: string
          processed_at: string | null
        }
        Insert: {
          id?: string
          seller_id: string
          amount: number
          pix_key: string
          status?: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed'
          type: 'normal' | 'instant'
          fee?: number
          created_at?: string
          processed_at?: string | null
        }
        Update: {
          id?: string
          seller_id?: string
          amount?: number
          pix_key?: string
          status?: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed'
          type?: 'normal' | 'instant'
          fee?: number
          created_at?: string
          processed_at?: string | null
        }
      }
      documents: {
        Row: {
          id: string
          user_id: string
          type: 'rg' | 'birth_certificate'
          file_url: string
          status: 'pending' | 'approved' | 'rejected'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'rg' | 'birth_certificate'
          file_url: string
          status?: 'pending' | 'approved' | 'rejected'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'rg' | 'birth_certificate'
          file_url?: string
          status?: 'pending' | 'approved' | 'rejected'
          created_at?: string
        }
      }
      discord_connections: {
        Row: {
          id: string
          user_id: string
          discord_id: string
          discord_username: string
          discord_avatar: string | null
          access_token: string
          refresh_token: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          discord_id: string
          discord_username: string
          discord_avatar?: string | null
          access_token: string
          refresh_token: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          discord_id?: string
          discord_username?: string
          discord_avatar?: string | null
          access_token?: string
          refresh_token?: string
          created_at?: string
          updated_at?: string
        }
      }
      global_notices: {
        Row: {
          id: string
          title: string
          content: string
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string
          active?: boolean
          created_at?: string
        }
      }
      config: {
        Row: {
          id: string
          key: string
          value: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'user' | 'seller' | 'support' | 'admin'
      product_status: 'pending' | 'approved' | 'rejected'
      purchase_status: 'pending' | 'paid' | 'delivered' | 'dispute'
      ticket_status: 'open' | 'closed'
      withdrawal_status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed'
      document_status: 'pending' | 'approved' | 'rejected'
      document_type: 'rg' | 'birth_certificate'
      delivery_type: 'manual' | 'automatic'
      withdrawal_type: 'normal' | 'instant'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, 'public'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
