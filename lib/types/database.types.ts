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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      animation_captures: {
        Row: {
          animation_context: Json | null
          created_at: string | null
          duration: number | null
          error_message: string | null
          id: string
          node_id: string | null
          page_title: string | null
          replay_url: string | null
          screenshot_after: string | null
          screenshot_before: string | null
          selector: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["capture_status"]
          updated_at: string | null
          url: string
          user_id: string
          video_url: string | null
          workflow_id: string | null
        }
        Insert: {
          animation_context?: Json | null
          created_at?: string | null
          duration?: number | null
          error_message?: string | null
          id?: string
          node_id?: string | null
          page_title?: string | null
          replay_url?: string | null
          screenshot_after?: string | null
          screenshot_before?: string | null
          selector?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["capture_status"]
          updated_at?: string | null
          url: string
          user_id: string
          video_url?: string | null
          workflow_id?: string | null
        }
        Update: {
          animation_context?: Json | null
          created_at?: string | null
          duration?: number | null
          error_message?: string | null
          id?: string
          node_id?: string | null
          page_title?: string | null
          replay_url?: string | null
          screenshot_after?: string | null
          screenshot_before?: string | null
          selector?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["capture_status"]
          updated_at?: string | null
          url?: string
          user_id?: string
          video_url?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "animation_captures_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      edges: {
        Row: {
          created_at: string | null
          edge_id: string
          edge_type: string | null
          id: string
          source_handle: string | null
          source_node_id: string
          target_handle: string | null
          target_node_id: string
          workflow_id: string
        }
        Insert: {
          created_at?: string | null
          edge_id: string
          edge_type?: string | null
          id?: string
          source_handle?: string | null
          source_node_id: string
          target_handle?: string | null
          target_node_id: string
          workflow_id: string
        }
        Update: {
          created_at?: string | null
          edge_id?: string
          edge_type?: string | null
          id?: string
          source_handle?: string | null
          source_node_id?: string
          target_handle?: string | null
          target_node_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edges_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      nodes: {
        Row: {
          created_at: string | null
          data: Json
          height: number | null
          id: string
          node_id: string
          node_type: string
          position_x: number
          position_y: number
          updated_at: string | null
          width: number | null
          workflow_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json
          height?: number | null
          id?: string
          node_id: string
          node_type: string
          position_x?: number
          position_y?: number
          updated_at?: string | null
          width?: number | null
          workflow_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          height?: number | null
          id?: string
          node_id?: string
          node_type?: string
          position_x?: number
          position_y?: number
          updated_at?: string | null
          width?: number | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nodes_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      vercel_logs: {
        Row: {
          branch: string | null
          created_at: string | null
          deployment_id: string | null
          environment: string | null
          host: string | null
          id: string
          level: string | null
          log_id: string | null
          message: string | null
          path: string | null
          project_id: string | null
          project_name: string | null
          raw_payload: Json | null
          region: string | null
          request_id: string | null
          source: string | null
          status_code: number | null
          timestamp: string | null
        }
        Insert: {
          branch?: string | null
          created_at?: string | null
          deployment_id?: string | null
          environment?: string | null
          host?: string | null
          id?: string
          level?: string | null
          log_id?: string | null
          message?: string | null
          path?: string | null
          project_id?: string | null
          project_name?: string | null
          raw_payload?: Json | null
          region?: string | null
          request_id?: string | null
          source?: string | null
          status_code?: number | null
          timestamp?: string | null
        }
        Update: {
          branch?: string | null
          created_at?: string | null
          deployment_id?: string | null
          environment?: string | null
          host?: string | null
          id?: string
          level?: string | null
          log_id?: string | null
          message?: string | null
          path?: string | null
          project_id?: string | null
          project_name?: string | null
          raw_payload?: Json | null
          region?: string | null
          request_id?: string | null
          source?: string | null
          status_code?: number | null
          timestamp?: string | null
        }
        Relationships: []
      }
      workflows: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_template: boolean | null
          name: string | null
          session_id: string | null
          template_icon: string | null
          template_tags: string[] | null
          tool_type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_template?: boolean | null
          name?: string | null
          session_id?: string | null
          template_icon?: string | null
          template_tags?: string[] | null
          tool_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_template?: boolean | null
          name?: string | null
          session_id?: string | null
          template_icon?: string | null
          template_tags?: string[] | null
          tool_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      important_errors: {
        Row: {
          deployment_id: string | null
          environment: string | null
          error_message: string | null
          id: string | null
          level: string | null
          path: string | null
          raw_message: string | null
          raw_payload: Json | null
          request_id: string | null
          service: string | null
          status_code: number | null
          timestamp: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_old_logs: { Args: never; Returns: number }
      cleanup_stale_workflows: { Args: never; Returns: undefined }
    }
    Enums: {
      capture_status: "pending" | "processing" | "completed" | "failed"
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
      capture_status: ["pending", "processing", "completed", "failed"],
    },
  },
} as const
