export interface WaitlistLead {
  id: string;
  email: string;
  vertical: string | null;
  locale: string | null;
  utm: Record<string, string> | null;
  created_at: string;
}

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      waitlist_leads: {
        Row: {
          id: string;
          email: string;
          vertical: string | null;
          locale: string | null;
          utm: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          vertical?: string | null;
          locale?: string | null;
          utm?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          vertical?: string | null;
          locale?: string | null;
          utm?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          locale: string | null;
          marketing_consent: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          locale?: string | null;
          marketing_consent?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          locale?: string | null;
          marketing_consent?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          owner_id: string | null;
          created_at: string;
          updated_at: string;
          locale: string | null;
          source_type: string | null;
          title: string | null;
          status: string;
          schema_version: string;
          report_json: Json;
          input_char_count: number | null;
          source_fingerprint: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
          locale?: string | null;
          source_type?: string | null;
          title?: string | null;
          status?: string;
          schema_version?: string;
          report_json: Json;
          input_char_count?: number | null;
          source_fingerprint?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          created_at?: string;
          updated_at?: string;
          locale?: string | null;
          source_type?: string | null;
          title?: string | null;
          status?: string;
          schema_version?: string;
          report_json?: Json;
          input_char_count?: number | null;
          source_fingerprint?: string | null;
        };
        Relationships: [];
      };
      entitlements: {
        Row: {
          id: string;
          user_id: string | null;
          report_id: string | null;
          kind: string | null;
          status: string;
          stripe_customer_id: string | null;
          stripe_payment_intent_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          report_id?: string | null;
          kind?: string | null;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_payment_intent_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          report_id?: string | null;
          kind?: string | null;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_payment_intent_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
