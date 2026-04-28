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
      appointments: {
        Row: {
          client_id: string | null
          coach_id: string
          color: string | null
          created_at: string
          description: string | null
          end_time: string
          id: string
          is_recurring: boolean
          location: string | null
          recurrence_rule: string | null
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          coach_id: string
          color?: string | null
          created_at?: string
          description?: string | null
          end_time: string
          id?: string
          is_recurring?: boolean
          location?: string | null
          recurrence_rule?: string | null
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          coach_id?: string
          color?: string | null
          created_at?: string
          description?: string | null
          end_time?: string
          id?: string
          is_recurring?: boolean
          location?: string | null
          recurrence_rule?: string | null
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_documents: {
        Row: {
          created_at: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          name: string
          uploaded_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          name: string
          uploaded_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          name?: string
          uploaded_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      client_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_assignments: {
        Row: {
          assigned_at: string
          client_id: string
          coach_id: string
          id: string
          is_primary: boolean
        }
        Insert: {
          assigned_at?: string
          client_id: string
          coach_id: string
          id?: string
          is_primary?: boolean
        }
        Update: {
          assigned_at?: string
          client_id?: string
          coach_id?: string
          id?: string
          is_primary?: boolean
        }
        Relationships: []
      }
      coach_test_notes: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          note: string | null
          rating: number | null
          updated_at: string
          workout_plan_exercise_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          note?: string | null
          rating?: number | null
          updated_at?: string
          workout_plan_exercise_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          note?: string | null
          rating?: number | null
          updated_at?: string
          workout_plan_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_test_notes_workout_plan_exercise_id_fkey"
            columns: ["workout_plan_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_plan_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      course_participants: {
        Row: {
          course_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_participants_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_sessions: {
        Row: {
          cancellation_reason: string | null
          course_id: string
          created_at: string
          end_time: string
          id: string
          is_cancelled: boolean
          start_time: string
        }
        Insert: {
          cancellation_reason?: string | null
          course_id: string
          created_at?: string
          end_time: string
          id?: string
          is_cancelled?: boolean
          start_time: string
        }
        Update: {
          cancellation_reason?: string | null
          course_id?: string
          created_at?: string
          end_time?: string
          id?: string
          is_cancelled?: boolean
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          coach_id: string | null
          color: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          max_participants: number | null
          name: string
          schedule: string | null
        }
        Insert: {
          coach_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          max_participants?: number | null
          name: string
          schedule?: string | null
        }
        Update: {
          coach_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          max_participants?: number | null
          name?: string
          schedule?: string | null
        }
        Relationships: []
      }
      error_reports: {
        Row: {
          client_id: string
          coach_id: string
          coach_response: string | null
          description: string
          exercise_id: string | null
          id: string
          reported_at: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["error_report_status"]
          title: string
          workout_plan_id: string | null
        }
        Insert: {
          client_id: string
          coach_id: string
          coach_response?: string | null
          description: string
          exercise_id?: string | null
          id?: string
          reported_at?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["error_report_status"]
          title: string
          workout_plan_id?: string | null
        }
        Update: {
          client_id?: string
          coach_id?: string
          coach_response?: string | null
          description?: string
          exercise_id?: string | null
          id?: string
          reported_at?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["error_report_status"]
          title?: string
          workout_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_reports_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_reports_workout_plan_id_fkey"
            columns: ["workout_plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_videos: {
        Row: {
          coach_id: string
          created_at: string
          duration_seconds: number | null
          exercise_id: string
          id: string
          thumbnail_url: string | null
          title: string
          video_url: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          duration_seconds?: number | null
          exercise_id: string
          id?: string
          thumbnail_url?: string | null
          title: string
          video_url: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          duration_seconds?: number | null
          exercise_id?: string
          id?: string
          thumbnail_url?: string | null
          title?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_videos_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          difficulty: string | null
          id: string
          muscle_group: string | null
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          id?: string
          muscle_group?: string | null
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          id?: string
          muscle_group?: string | null
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          date: string
          id: string
          is_deductible: boolean
          is_paid: boolean
          is_recurring: boolean
          notes: string | null
          provider: string | null
          subcategory: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          is_deductible?: boolean
          is_paid?: boolean
          is_recurring?: boolean
          notes?: string | null
          provider?: string | null
          subcategory: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          is_deductible?: boolean
          is_paid?: boolean
          is_recurring?: boolean
          notes?: string | null
          provider?: string | null
          subcategory?: string
          updated_at?: string
        }
        Relationships: []
      }
      gym_hours: {
        Row: {
          close_time: string
          day_of_week: number
          id: string
          is_closed: boolean
          note: string | null
          open_time: string
        }
        Insert: {
          close_time: string
          day_of_week: number
          id?: string
          is_closed?: boolean
          note?: string | null
          open_time: string
        }
        Update: {
          close_time?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean
          note?: string | null
          open_time?: string
        }
        Relationships: []
      }
      lesson_packages: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          price: number
          remaining_lessons: number
          total_lessons: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          price?: number
          remaining_lessons: number
          total_lessons: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          price?: number
          remaining_lessons?: number
          total_lessons?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lesson_usage_log: {
        Row: {
          appointment_id: string | null
          created_by: string | null
          id: string
          notes: string | null
          package_id: string
          used_at: string
        }
        Insert: {
          appointment_id?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          package_id: string
          used_at?: string
        }
        Update: {
          appointment_id?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          package_id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_usage_log_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_usage_log_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "lesson_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          created_at: string
          description: string | null
          duration_months: number
          id: string
          is_active: boolean
          name: string
          plan_type: Database["public"]["Enums"]["user_role"]
          price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_months?: number
          id?: string
          is_active?: boolean
          name: string
          plan_type?: Database["public"]["Enums"]["user_role"]
          price: number
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_months?: number
          id?: string
          is_active?: boolean
          name?: string
          plan_type?: Database["public"]["Enums"]["user_role"]
          price?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          notes: string | null
          payment_date: string
          receipt_number: string | null
          recorded_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          subscription_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          payment_date?: string
          receipt_number?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          payment_date?: string
          receipt_number?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          emergency_contact: string | null
          first_name: string
          fiscal_code: string | null
          id: string
          last_name: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact?: string | null
          first_name: string
          fiscal_code?: string | null
          id?: string
          last_name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact?: string | null
          first_name?: string
          fiscal_code?: string | null
          id?: string
          last_name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          end_date: string
          id: string
          notes: string | null
          plan_id: string
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          plan_id: string
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          plan_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_completions: {
        Row: {
          actual_reps: string | null
          actual_sets: number | null
          client_id: string
          client_notes: string | null
          completed_at: string
          difficulty_rating: number | null
          id: string
          set_number: number
          weight_used: string | null
          workout_plan_exercise_id: string
        }
        Insert: {
          actual_reps?: string | null
          actual_sets?: number | null
          client_id: string
          client_notes?: string | null
          completed_at?: string
          difficulty_rating?: number | null
          id?: string
          set_number?: number
          weight_used?: string | null
          workout_plan_exercise_id: string
        }
        Update: {
          actual_reps?: string | null
          actual_sets?: number | null
          client_id?: string
          client_notes?: string | null
          completed_at?: string
          difficulty_rating?: number | null
          id?: string
          set_number?: number
          weight_used?: string | null
          workout_plan_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_completions_workout_plan_exercise_id_fkey"
            columns: ["workout_plan_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_plan_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plan_exercises: {
        Row: {
          created_at: string
          day_of_week: number | null
          exercise_id: string | null
          exercise_name: string | null
          id: string
          notes: string | null
          order_index: number
          reps: string | null
          rest_seconds: number | null
          sets: number | null
          video_id: string | null
          workout_plan_id: string
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          exercise_id?: string | null
          exercise_name?: string | null
          id?: string
          notes?: string | null
          order_index?: number
          reps?: string | null
          rest_seconds?: number | null
          sets?: number | null
          video_id?: string | null
          workout_plan_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          exercise_id?: string | null
          exercise_name?: string | null
          id?: string
          notes?: string | null
          order_index?: number
          reps?: string | null
          rest_seconds?: number | null
          sets?: number | null
          video_id?: string | null
          workout_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_plan_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_plan_exercises_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "exercise_videos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_plan_exercises_workout_plan_id_fkey"
            columns: ["workout_plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plans: {
        Row: {
          client_id: string
          coach_id: string
          coach_notes: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          end_date: string
          id: string
          is_active: boolean
          name: string
          paused_at: string | null
          plan_type: string
          reminder_appointment_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["workout_plan_status"]
          test_reminder_days: number
          total_paused_days: number
          updated_at: string
        }
        Insert: {
          client_id: string
          coach_id: string
          coach_notes?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          paused_at?: string | null
          plan_type?: string
          reminder_appointment_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["workout_plan_status"]
          test_reminder_days?: number
          total_paused_days?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          coach_id?: string
          coach_notes?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          paused_at?: string | null
          plan_type?: string
          reminder_appointment_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["workout_plan_status"]
          test_reminder_days?: number
          total_paused_days?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_client_data: {
        Args: { client_uuid: string; viewer_uuid: string }
        Returns: boolean
      }
      coach_manages_client: {
        Args: { client_uuid: string; coach_uuid: string }
        Returns: boolean
      }
      get_user_role: {
        Args: { user_uuid: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin: { Args: { user_uuid: string }; Returns: boolean }
      is_coach: { Args: { user_uuid: string }; Returns: boolean }
      is_staff: { Args: { user_uuid: string }; Returns: boolean }
    }
    Enums: {
      error_report_status: "aperta" | "in_lavorazione" | "risolta" | "chiusa"
      expense_category: "fissa" | "variabile"
      payment_status: "completato" | "in_attesa" | "fallito" | "rimborsato"
      subscription_status: "attivo" | "scaduto" | "sospeso" | "cancellato"
      user_role:
        | "admin"
        | "coach"
        | "cliente_palestra"
        | "cliente_coaching"
        | "cliente_corso"
      workout_plan_status: "attiva" | "in_pausa" | "conclusa"
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
      error_report_status: ["aperta", "in_lavorazione", "risolta", "chiusa"],
      expense_category: ["fissa", "variabile"],
      payment_status: ["completato", "in_attesa", "fallito", "rimborsato"],
      subscription_status: ["attivo", "scaduto", "sospeso", "cancellato"],
      user_role: [
        "admin",
        "coach",
        "cliente_palestra",
        "cliente_coaching",
        "cliente_corso",
      ],
      workout_plan_status: ["attiva", "in_pausa", "conclusa"],
    },
  },
} as const
