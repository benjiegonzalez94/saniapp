// GENERADO AUTOMÁTICAMENTE — no editar a mano. npm run db:types

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
      allergies: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          onset_date: string | null
          patient_id: string
          reaction: string | null
          recorded_by: string
          severity: "leve" | "moderada" | "severa" | "mortal"
          substance: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          onset_date?: string | null
          patient_id: string
          reaction?: string | null
          recorded_by: string
          severity?: "leve" | "moderada" | "severa" | "mortal"
          substance: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          onset_date?: string | null
          patient_id?: string
          reaction?: string | null
          recorded_by?: string
          severity?: "leve" | "moderada" | "severa" | "mortal"
          substance?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "allergies_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allergies_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allergies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_reminders: {
        Row: {
          appointment_id: string
          attempts: number
          channel: "whatsapp" | "sms" | "email"
          created_at: string
          failed_reason: string | null
          id: string
          provider_message_id: string | null
          scheduled_for: string
          sent_at: string | null
          status:
            | "programado"
            | "enviando"
            | "enviado"
            | "fallido"
            | "cancelado"
            | "sin_consentimiento"
          tenant_id: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          attempts?: number
          channel: "whatsapp" | "sms" | "email"
          created_at?: string
          failed_reason?: string | null
          id?: string
          provider_message_id?: string | null
          scheduled_for: string
          sent_at?: string | null
          status?:
            | "programado"
            | "enviando"
            | "enviado"
            | "fallido"
            | "cancelado"
            | "sin_consentimiento"
          tenant_id: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          attempts?: number
          channel?: "whatsapp" | "sms" | "email"
          created_at?: string
          failed_reason?: string | null
          id?: string
          provider_message_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?:
            | "programado"
            | "enviando"
            | "enviado"
            | "fallido"
            | "cancelado"
            | "sin_consentimiento"
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_reminders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          checked_in_at: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          encounter_id: string | null
          ends_at: string
          id: string
          kind:
            | "consulta"
            | "control"
            | "emergencia"
            | "teleconsulta"
            | "procedimiento"
            | "domiciliaria"
          location_id: string | null
          patient_id: string
          private_note: string | null
          provider_id: string
          reason: string | null
          rescheduled_from: string | null
          slot: unknown
          source:
            | "web"
            | "whatsapp"
            | "telefono"
            | "presencial"
            | "portal_paciente"
          starts_at: string
          status:
            | "solicitada"
            | "confirmada"
            | "en_sala"
            | "atendida"
            | "cancelada"
            | "no_asistio"
            | "reprogramada"
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          checked_in_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          encounter_id?: string | null
          ends_at: string
          id?: string
          kind?:
            | "consulta"
            | "control"
            | "emergencia"
            | "teleconsulta"
            | "procedimiento"
            | "domiciliaria"
          location_id?: string | null
          patient_id: string
          private_note?: string | null
          provider_id: string
          reason?: string | null
          rescheduled_from?: string | null
          slot?: unknown
          source?:
            | "web"
            | "whatsapp"
            | "telefono"
            | "presencial"
            | "portal_paciente"
          starts_at: string
          status?:
            | "solicitada"
            | "confirmada"
            | "en_sala"
            | "atendida"
            | "cancelada"
            | "no_asistio"
            | "reprogramada"
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          checked_in_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          encounter_id?: string | null
          ends_at?: string
          id?: string
          kind?:
            | "consulta"
            | "control"
            | "emergencia"
            | "teleconsulta"
            | "procedimiento"
            | "domiciliaria"
          location_id?: string | null
          patient_id?: string
          private_note?: string | null
          provider_id?: string
          reason?: string | null
          rescheduled_from?: string | null
          slot?: unknown
          source?:
            | "web"
            | "whatsapp"
            | "telefono"
            | "presencial"
            | "portal_paciente"
          starts_at?: string
          status?:
            | "solicitada"
            | "confirmada"
            | "en_sala"
            | "atendida"
            | "cancelada"
            | "no_asistio"
            | "reprogramada"
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_rescheduled_from_fkey"
            columns: ["rescheduled_from"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id: string | null
          actor_ip: unknown
          actor_label: string
          actor_role:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent: string | null
          break_glass_reason: string | null
          id: number
          metadata: Json
          occurred_at: string
          patient_id: string | null
          prev_hash: string | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          row_hash: string
          summary: string | null
          tenant_id: string | null
        }
        Insert: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          row_hash: string
          summary?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          row_hash?: string
          summary?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log_2026_08: {
        Row: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id: string | null
          actor_ip: unknown
          actor_label: string
          actor_role:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent: string | null
          break_glass_reason: string | null
          id: number
          metadata: Json
          occurred_at: string
          patient_id: string | null
          prev_hash: string | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          row_hash: string
          summary: string | null
          tenant_id: string | null
        }
        Insert: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          row_hash: string
          summary?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          row_hash?: string
          summary?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_09: {
        Row: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id: string | null
          actor_ip: unknown
          actor_label: string
          actor_role:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent: string | null
          break_glass_reason: string | null
          id: number
          metadata: Json
          occurred_at: string
          patient_id: string | null
          prev_hash: string | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          row_hash: string
          summary: string | null
          tenant_id: string | null
        }
        Insert: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          row_hash: string
          summary?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          row_hash?: string
          summary?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_10: {
        Row: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id: string | null
          actor_ip: unknown
          actor_label: string
          actor_role:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent: string | null
          break_glass_reason: string | null
          id: number
          metadata: Json
          occurred_at: string
          patient_id: string | null
          prev_hash: string | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          row_hash: string
          summary: string | null
          tenant_id: string | null
        }
        Insert: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          row_hash: string
          summary?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          row_hash?: string
          summary?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_11: {
        Row: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id: string | null
          actor_ip: unknown
          actor_label: string
          actor_role:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent: string | null
          break_glass_reason: string | null
          id: number
          metadata: Json
          occurred_at: string
          patient_id: string | null
          prev_hash: string | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          row_hash: string
          summary: string | null
          tenant_id: string | null
        }
        Insert: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          row_hash: string
          summary?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          row_hash?: string
          summary?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_12: {
        Row: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id: string | null
          actor_ip: unknown
          actor_label: string
          actor_role:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent: string | null
          break_glass_reason: string | null
          id: number
          metadata: Json
          occurred_at: string
          patient_id: string | null
          prev_hash: string | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          row_hash: string
          summary: string | null
          tenant_id: string | null
        }
        Insert: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          row_hash: string
          summary?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          row_hash?: string
          summary?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      audit_log_2027_01: {
        Row: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id: string | null
          actor_ip: unknown
          actor_label: string
          actor_role:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent: string | null
          break_glass_reason: string | null
          id: number
          metadata: Json
          occurred_at: string
          patient_id: string | null
          prev_hash: string | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          row_hash: string
          summary: string | null
          tenant_id: string | null
        }
        Insert: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          row_hash: string
          summary?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          row_hash?: string
          summary?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      audit_log_2027_02: {
        Row: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id: string | null
          actor_ip: unknown
          actor_label: string
          actor_role:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent: string | null
          break_glass_reason: string | null
          id: number
          metadata: Json
          occurred_at: string
          patient_id: string | null
          prev_hash: string | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          row_hash: string
          summary: string | null
          tenant_id: string | null
        }
        Insert: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          row_hash: string
          summary?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          row_hash?: string
          summary?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      audit_log_2027_03: {
        Row: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id: string | null
          actor_ip: unknown
          actor_label: string
          actor_role:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent: string | null
          break_glass_reason: string | null
          id: number
          metadata: Json
          occurred_at: string
          patient_id: string | null
          prev_hash: string | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          row_hash: string
          summary: string | null
          tenant_id: string | null
        }
        Insert: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          row_hash: string
          summary?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          row_hash?: string
          summary?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      audit_log_2027_04: {
        Row: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id: string | null
          actor_ip: unknown
          actor_label: string
          actor_role:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent: string | null
          break_glass_reason: string | null
          id: number
          metadata: Json
          occurred_at: string
          patient_id: string | null
          prev_hash: string | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          row_hash: string
          summary: string | null
          tenant_id: string | null
        }
        Insert: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          row_hash: string
          summary?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          row_hash?: string
          summary?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      audit_log_2027_05: {
        Row: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id: string | null
          actor_ip: unknown
          actor_label: string
          actor_role:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent: string | null
          break_glass_reason: string | null
          id: number
          metadata: Json
          occurred_at: string
          patient_id: string | null
          prev_hash: string | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          row_hash: string
          summary: string | null
          tenant_id: string | null
        }
        Insert: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          row_hash: string
          summary?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          row_hash?: string
          summary?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      audit_log_2027_06: {
        Row: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id: string | null
          actor_ip: unknown
          actor_label: string
          actor_role:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent: string | null
          break_glass_reason: string | null
          id: number
          metadata: Json
          occurred_at: string
          patient_id: string | null
          prev_hash: string | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          row_hash: string
          summary: string | null
          tenant_id: string | null
        }
        Insert: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          row_hash: string
          summary?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          row_hash?: string
          summary?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      audit_log_2027_07: {
        Row: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id: string | null
          actor_ip: unknown
          actor_label: string
          actor_role:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent: string | null
          break_glass_reason: string | null
          id: number
          metadata: Json
          occurred_at: string
          patient_id: string | null
          prev_hash: string | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          row_hash: string
          summary: string | null
          tenant_id: string | null
        }
        Insert: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          row_hash: string
          summary?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          row_hash?: string
          summary?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      audit_log_2027_08: {
        Row: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id: string | null
          actor_ip: unknown
          actor_label: string
          actor_role:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent: string | null
          break_glass_reason: string | null
          id: number
          metadata: Json
          occurred_at: string
          patient_id: string | null
          prev_hash: string | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          row_hash: string
          summary: string | null
          tenant_id: string | null
        }
        Insert: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          row_hash: string
          summary?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          row_hash?: string
          summary?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      audit_log_default: {
        Row: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id: string | null
          actor_ip: unknown
          actor_label: string
          actor_role:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent: string | null
          break_glass_reason: string | null
          id: number
          metadata: Json
          occurred_at: string
          patient_id: string | null
          prev_hash: string | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          row_hash: string
          summary: string | null
          tenant_id: string | null
        }
        Insert: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          row_hash: string
          summary?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          actor_id?: string | null
          actor_ip?: unknown
          actor_label?: string
          actor_role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
            | null
          actor_user_agent?: string | null
          break_glass_reason?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          prev_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          row_hash?: string
          summary?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      auth_events: {
        Row: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          detail: Json
          email: string | null
          id: number
          ip: unknown
          occurred_at: string
          profile_id: string | null
          succeeded: boolean
          user_agent: string | null
        }
        Insert: {
          action:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          detail?: Json
          email?: string | null
          id?: never
          ip?: unknown
          occurred_at?: string
          profile_id?: string | null
          succeeded: boolean
          user_agent?: string | null
        }
        Update: {
          action?:
            | "read"
            | "create"
            | "update"
            | "delete"
            | "export"
            | "print"
            | "share"
            | "unshare"
            | "sign"
            | "login"
            | "logout"
            | "login_failed"
            | "mfa_challenge"
            | "mfa_failed"
            | "permission_denied"
            | "break_glass"
            | "invite"
            | "role_change"
            | "consent_grant"
            | "consent_revoke"
            | "send_message"
          detail?: Json
          email?: string | null
          id?: never
          ip?: unknown
          occurred_at?: string
          profile_id?: string | null
          succeeded?: boolean
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          provider: "payphone" | "kushki" | "manual"
          provider_event_id: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          provider: "payphone" | "kushki" | "manual"
          provider_event_id: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: "payphone" | "kushki" | "manual"
          provider_event_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      break_glass_grants: {
        Row: {
          created_at: string
          expires_at: string
          granted_at: string
          id: string
          patient_id: string
          profile_id: string
          reason: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          granted_at?: string
          id?: string
          patient_id: string
          profile_id: string
          reason: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          granted_at?: string
          id?: string
          patient_id?: string
          profile_id?: string
          reason?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "break_glass_grants_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "break_glass_grants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "break_glass_grants_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "break_glass_grants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      care_team_members: {
        Row: {
          added_by: string | null
          created_at: string
          ended_at: string | null
          id: string
          patient_id: string
          profile_id: string
          relationship: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          patient_id: string
          profile_id: string
          relationship?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          patient_id?: string
          profile_id?: string
          relationship?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_team_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_team_members_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_team_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      case_consult_messages: {
        Row: {
          author_id: string
          body_enc: string
          consult_id: string
          created_at: string
          id: string
          key_version: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body_enc: string
          consult_id: string
          created_at?: string
          id?: string
          key_version?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body_enc?: string
          consult_id?: string
          created_at?: string
          id?: string
          key_version?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_consult_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_consult_messages_consult_id_fkey"
            columns: ["consult_id"]
            isOneToOne: false
            referencedRelation: "case_consults"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_consult_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      case_consults: {
        Row: {
          answered_at: string | null
          assigned_to: string
          closed_at: string | null
          created_at: string
          encounter_id: string | null
          id: string
          patient_id: string
          question: string
          requested_by: string
          specialty: string | null
          status: "abierta" | "respondida" | "cerrada"
          tenant_id: string
          updated_at: string
        }
        Insert: {
          answered_at?: string | null
          assigned_to: string
          closed_at?: string | null
          created_at?: string
          encounter_id?: string | null
          id?: string
          patient_id: string
          question: string
          requested_by: string
          specialty?: string | null
          status?: "abierta" | "respondida" | "cerrada"
          tenant_id: string
          updated_at?: string
        }
        Update: {
          answered_at?: string | null
          assigned_to?: string
          closed_at?: string | null
          created_at?: string
          encounter_id?: string | null
          id?: string
          patient_id?: string
          question?: string
          requested_by?: string
          specialty?: string | null
          status?: "abierta" | "respondida" | "cerrada"
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_consults_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_consults_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_consults_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_consults_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_consults_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_notes: {
        Row: {
          amended_by: string | null
          amendment_reason: string | null
          author_id: string
          content_enc: string
          created_at: string
          encounter_id: string | null
          id: string
          key_version: number
          patient_id: string
          signed_at: string | null
          signed_by: string | null
          tenant_id: string
          title: string | null
          updated_at: string
          word_count: number | null
        }
        Insert: {
          amended_by?: string | null
          amendment_reason?: string | null
          author_id: string
          content_enc: string
          created_at?: string
          encounter_id?: string | null
          id?: string
          key_version?: number
          patient_id: string
          signed_at?: string | null
          signed_by?: string | null
          tenant_id: string
          title?: string | null
          updated_at?: string
          word_count?: number | null
        }
        Update: {
          amended_by?: string | null
          amendment_reason?: string | null
          author_id?: string
          content_enc?: string
          created_at?: string
          encounter_id?: string | null
          id?: string
          key_version?: number
          patient_id?: string
          signed_at?: string | null
          signed_by?: string | null
          tenant_id?: string
          title?: string | null
          updated_at?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_notes_amended_by_fkey"
            columns: ["amended_by"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_notes_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_notes_signed_by_fkey"
            columns: ["signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      data_subject_requests: {
        Row: {
          created_at: string
          detail: string | null
          due_at: string
          handled_by: string | null
          id: string
          kind:
            | "acceso"
            | "rectificacion"
            | "eliminacion"
            | "portabilidad"
            | "oposicion"
            | "limitacion"
          patient_id: string | null
          received_at: string
          requester_email: string
          resolution: string | null
          resolved_at: string | null
          status: "recibida" | "en_proceso" | "completada" | "rechazada"
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          due_at: string
          handled_by?: string | null
          id?: string
          kind:
            | "acceso"
            | "rectificacion"
            | "eliminacion"
            | "portabilidad"
            | "oposicion"
            | "limitacion"
          patient_id?: string | null
          received_at?: string
          requester_email: string
          resolution?: string | null
          resolved_at?: string | null
          status?: "recibida" | "en_proceso" | "completada" | "rechazada"
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          due_at?: string
          handled_by?: string | null
          id?: string
          kind?:
            | "acceso"
            | "rectificacion"
            | "eliminacion"
            | "portabilidad"
            | "oposicion"
            | "limitacion"
          patient_id?: string | null
          received_at?: string
          requester_email?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: "recibida" | "en_proceso" | "completada" | "rechazada"
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_subject_requests_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_subject_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_subject_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnoses: {
        Row: {
          amended_by: string | null
          code: string
          code_system: string
          created_at: string
          display: string
          encounter_id: string | null
          id: string
          is_chronic: boolean
          kind: "presuntivo" | "definitivo" | "descartado"
          notes: string | null
          onset_date: string | null
          patient_id: string
          recorded_by: string
          resolved_at: string | null
          signed_at: string | null
          signed_by: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amended_by?: string | null
          code: string
          code_system?: string
          created_at?: string
          display: string
          encounter_id?: string | null
          id?: string
          is_chronic?: boolean
          kind?: "presuntivo" | "definitivo" | "descartado"
          notes?: string | null
          onset_date?: string | null
          patient_id: string
          recorded_by: string
          resolved_at?: string | null
          signed_at?: string | null
          signed_by?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amended_by?: string | null
          code?: string
          code_system?: string
          created_at?: string
          display?: string
          encounter_id?: string | null
          id?: string
          is_chronic?: boolean
          kind?: "presuntivo" | "definitivo" | "descartado"
          notes?: string | null
          onset_date?: string | null
          patient_id?: string
          recorded_by?: string
          resolved_at?: string | null
          signed_at?: string | null
          signed_by?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnoses_amended_by_fkey"
            columns: ["amended_by"]
            isOneToOne: false
            referencedRelation: "diagnoses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnoses_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnoses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnoses_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnoses_signed_by_fkey"
            columns: ["signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnoses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_shares: {
        Row: {
          can_download: boolean
          created_at: string
          document_id: string
          expires_at: string | null
          first_viewed_at: string | null
          id: string
          message: string | null
          revoked_at: string | null
          shared_by: string
          shared_with: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          can_download?: boolean
          created_at?: string
          document_id: string
          expires_at?: string | null
          first_viewed_at?: string | null
          id?: string
          message?: string | null
          revoked_at?: string | null
          shared_by: string
          shared_with: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          can_download?: boolean
          created_at?: string
          document_id?: string
          expires_at?: string | null
          first_viewed_at?: string | null
          id?: string
          message?: string | null
          revoked_at?: string | null
          shared_by?: string
          shared_with?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_shares_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_shares_shared_by_fkey"
            columns: ["shared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_shares_shared_with_fkey"
            columns: ["shared_with"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_shares_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          encounter_id: string | null
          id: string
          kind:
            | "laboratorio"
            | "imagen"
            | "informe"
            | "receta"
            | "consentimiento"
            | "referencia"
            | "certificado"
            | "otro"
          mime_type: string
          patient_id: string
          scan_attempts: number
          scan_claimed_at: string | null
          scan_detail: string | null
          scan_engine: string | null
          scan_signature_version: string | null
          scan_status: "pendiente" | "limpio" | "infectado" | "error"
          scanned_at: string | null
          sha256: string | null
          size_bytes: number
          storage_path: string
          study_date: string | null
          tenant_id: string
          title: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          encounter_id?: string | null
          id?: string
          kind?:
            | "laboratorio"
            | "imagen"
            | "informe"
            | "receta"
            | "consentimiento"
            | "referencia"
            | "certificado"
            | "otro"
          mime_type: string
          patient_id: string
          scan_attempts?: number
          scan_claimed_at?: string | null
          scan_detail?: string | null
          scan_engine?: string | null
          scan_signature_version?: string | null
          scan_status?: "pendiente" | "limpio" | "infectado" | "error"
          scanned_at?: string | null
          sha256?: string | null
          size_bytes: number
          storage_path: string
          study_date?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          encounter_id?: string | null
          id?: string
          kind?:
            | "laboratorio"
            | "imagen"
            | "informe"
            | "receta"
            | "consentimiento"
            | "referencia"
            | "certificado"
            | "otro"
          mime_type?: string
          patient_id?: string
          scan_attempts?: number
          scan_claimed_at?: string | null
          scan_detail?: string | null
          scan_engine?: string | null
          scan_signature_version?: string | null
          scan_status?: "pendiente" | "limpio" | "infectado" | "error"
          scanned_at?: string | null
          sha256?: string | null
          size_bytes?: number
          storage_path?: string
          study_date?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      encounters: {
        Row: {
          amended_by: string | null
          created_at: string
          created_by: string | null
          ended_at: string | null
          id: string
          kind:
            | "consulta"
            | "control"
            | "emergencia"
            | "teleconsulta"
            | "procedimiento"
            | "domiciliaria"
          patient_id: string
          provider_id: string
          reason: string | null
          signed_at: string | null
          signed_by: string | null
          started_at: string | null
          status:
            | "planificada"
            | "en_curso"
            | "finalizada"
            | "cancelada"
            | "no_asistio"
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amended_by?: string | null
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          kind?:
            | "consulta"
            | "control"
            | "emergencia"
            | "teleconsulta"
            | "procedimiento"
            | "domiciliaria"
          patient_id: string
          provider_id: string
          reason?: string | null
          signed_at?: string | null
          signed_by?: string | null
          started_at?: string | null
          status?:
            | "planificada"
            | "en_curso"
            | "finalizada"
            | "cancelada"
            | "no_asistio"
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amended_by?: string | null
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          kind?:
            | "consulta"
            | "control"
            | "emergencia"
            | "teleconsulta"
            | "procedimiento"
            | "domiciliaria"
          patient_id?: string
          provider_id?: string
          reason?: string | null
          signed_at?: string | null
          signed_by?: string | null
          started_at?: string | null
          status?:
            | "planificada"
            | "en_curso"
            | "finalizada"
            | "cancelada"
            | "no_asistio"
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "encounters_amended_by_fkey"
            columns: ["amended_by"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_signed_by_fkey"
            columns: ["signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      icd10_codes: {
        Row: {
          chapter: string
          code: string
          created_at: string
          display: string
          is_common: boolean
          keywords: string
          search_text: string | null
        }
        Insert: {
          chapter: string
          code: string
          created_at?: string
          display: string
          is_common?: boolean
          keywords?: string
          search_text?: string | null
        }
        Update: {
          chapter?: string
          code?: string
          created_at?: string
          display?: string
          is_common?: boolean
          keywords?: string
          search_text?: string | null
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          revoked_at: string | null
          role:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
          status: "pending" | "accepted" | "revoked" | "expired"
          tenant_id: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
          status?: "pending" | "accepted" | "revoked" | "expired"
          tenant_id: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
          status?: "pending" | "accepted" | "revoked" | "expired"
          tenant_id?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          currency: string
          due_at: string | null
          id: string
          issued_at: string | null
          line_items: Json
          number: string
          paid_at: string | null
          pdf_path: string | null
          period_end: string
          period_start: string
          provider_invoice_id: string | null
          seats_billed: number | null
          status: "borrador" | "emitida" | "pagada" | "vencida" | "anulada"
          subscription_id: string | null
          subtotal_cents: number
          tax_cents: number
          tax_rate_bps: number
          tenant_id: string
          total_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          due_at?: string | null
          id?: string
          issued_at?: string | null
          line_items?: Json
          number: string
          paid_at?: string | null
          pdf_path?: string | null
          period_end: string
          period_start: string
          provider_invoice_id?: string | null
          seats_billed?: number | null
          status?: "borrador" | "emitida" | "pagada" | "vencida" | "anulada"
          subscription_id?: string | null
          subtotal_cents: number
          tax_cents?: number
          tax_rate_bps?: number
          tenant_id: string
          total_cents?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          due_at?: string | null
          id?: string
          issued_at?: string | null
          line_items?: Json
          number?: string
          paid_at?: string | null
          pdf_path?: string | null
          period_end?: string
          period_start?: string
          provider_invoice_id?: string | null
          seats_billed?: number | null
          status?: "borrador" | "emitida" | "pagada" | "vencida" | "anulada"
          subscription_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          tax_rate_bps?: number
          tenant_id?: string
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address_line: string | null
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          tenant_id: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address_line?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          tenant_id: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address_line?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          tenant_id?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          allergen_keys: string[]
          brand_names: string
          category: string
          code: string
          created_at: string
          generic_name: string
          is_common: boolean
          presentations: string[]
          search_text: string | null
          usual_dose: string | null
          usual_frequency: string | null
        }
        Insert: {
          allergen_keys?: string[]
          brand_names?: string
          category: string
          code: string
          created_at?: string
          generic_name: string
          is_common?: boolean
          presentations?: string[]
          search_text?: string | null
          usual_dose?: string | null
          usual_frequency?: string | null
        }
        Update: {
          allergen_keys?: string[]
          brand_names?: string
          category?: string
          code?: string
          created_at?: string
          generic_name?: string
          is_common?: boolean
          presentations?: string[]
          search_text?: string | null
          usual_dose?: string | null
          usual_frequency?: string | null
        }
        Relationships: []
      }
      memberships: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_at: string
          invited_by: string | null
          profile_id: string
          revoked_at: string | null
          role:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
          status: "invited" | "active" | "suspended" | "revoked"
          tenant_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          profile_id: string
          revoked_at?: string | null
          role:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
          status?: "invited" | "active" | "suspended" | "revoked"
          tenant_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          profile_id?: string
          revoked_at?: string | null
          role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
          status?: "invited" | "active" | "suspended" | "revoked"
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempts: number
          body_preview: string | null
          channel: "whatsapp" | "sms" | "email"
          created_at: string
          dedupe_key: string
          failed_reason: string | null
          id: string
          next_attempt_at: string | null
          patient_id: string | null
          provider_message_id: string | null
          recipient: string
          scheduled_for: string
          sent_at: string | null
          status:
            | "programado"
            | "enviando"
            | "enviado"
            | "entregado"
            | "fallido"
            | "cancelado"
            | "sin_consentimiento"
          template: string
          tenant_id: string
          updated_at: string
          variables: Json
        }
        Insert: {
          attempts?: number
          body_preview?: string | null
          channel: "whatsapp" | "sms" | "email"
          created_at?: string
          dedupe_key: string
          failed_reason?: string | null
          id?: string
          next_attempt_at?: string | null
          patient_id?: string | null
          provider_message_id?: string | null
          recipient: string
          scheduled_for?: string
          sent_at?: string | null
          status?:
            | "programado"
            | "enviando"
            | "enviado"
            | "entregado"
            | "fallido"
            | "cancelado"
            | "sin_consentimiento"
          template: string
          tenant_id: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          attempts?: number
          body_preview?: string | null
          channel?: "whatsapp" | "sms" | "email"
          created_at?: string
          dedupe_key?: string
          failed_reason?: string | null
          id?: string
          next_attempt_at?: string | null
          patient_id?: string | null
          provider_message_id?: string | null
          recipient?: string
          scheduled_for?: string
          sent_at?: string | null
          status?:
            | "programado"
            | "enviando"
            | "enviado"
            | "entregado"
            | "fallido"
            | "cancelado"
            | "sin_consentimiento"
          template?: string
          tenant_id?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_consents: {
        Row: {
          created_at: string
          evidence: Json
          granted: boolean
          granted_at: string
          id: string
          method: string
          patient_id: string
          policy_version: string
          purpose:
            | "tratamiento_datos"
            | "atencion_medica"
            | "whatsapp"
            | "sms"
            | "email"
            | "compartir_interno"
            | "compartir_externo"
            | "investigacion"
          recorded_by: string | null
          revoked_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          evidence?: Json
          granted: boolean
          granted_at?: string
          id?: string
          method?: string
          patient_id: string
          policy_version: string
          purpose:
            | "tratamiento_datos"
            | "atencion_medica"
            | "whatsapp"
            | "sms"
            | "email"
            | "compartir_interno"
            | "compartir_externo"
            | "investigacion"
          recorded_by?: string | null
          revoked_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          evidence?: Json
          granted?: boolean
          granted_at?: string
          id?: string
          method?: string
          patient_id?: string
          policy_version?: string
          purpose?:
            | "tratamiento_datos"
            | "atencion_medica"
            | "whatsapp"
            | "sms"
            | "email"
            | "compartir_interno"
            | "compartir_externo"
            | "investigacion"
          recorded_by?: string | null
          revoked_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_consents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_consents_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_consents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address_line: string | null
          birth_date: string | null
          blood_type: string | null
          city: string | null
          country: string
          created_at: string
          created_by: string | null
          deceased_at: string | null
          deleted_at: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          family_name: string
          gender_identity: string | null
          given_name: string
          id: string
          id_document: "cedula" | "pasaporte" | "ruc" | "sin_documento"
          merged_into: string | null
          national_id_bidx: string | null
          national_id_enc: string | null
          national_id_last4: string | null
          notes: string | null
          phone: string | null
          profile_id: string | null
          province: string | null
          record_number: number | null
          sex_at_birth: "female" | "male" | "intersex" | "unknown"
          status: "active" | "inactive" | "deceased" | "merged"
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address_line?: string | null
          birth_date?: string | null
          blood_type?: string | null
          city?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          deceased_at?: string | null
          deleted_at?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          family_name: string
          gender_identity?: string | null
          given_name: string
          id?: string
          id_document?: "cedula" | "pasaporte" | "ruc" | "sin_documento"
          merged_into?: string | null
          national_id_bidx?: string | null
          national_id_enc?: string | null
          national_id_last4?: string | null
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          province?: string | null
          record_number?: number | null
          sex_at_birth?: "female" | "male" | "intersex" | "unknown"
          status?: "active" | "inactive" | "deceased" | "merged"
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address_line?: string | null
          birth_date?: string | null
          blood_type?: string | null
          city?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          deceased_at?: string | null
          deleted_at?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          family_name?: string
          gender_identity?: string | null
          given_name?: string
          id?: string
          id_document?: "cedula" | "pasaporte" | "ruc" | "sin_documento"
          merged_into?: string | null
          national_id_bidx?: string | null
          national_id_enc?: string | null
          national_id_last4?: string | null
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          province?: string | null
          record_number?: number | null
          sex_at_birth?: "female" | "male" | "intersex" | "unknown"
          status?: "active" | "inactive" | "deceased" | "merged"
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          description: string
          key: string
        }
        Insert: {
          description: string
          key: string
        }
        Update: {
          description?: string
          key?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          billing_interval: "mensual" | "anual"
          code: string
          created_at: string
          currency: string
          description: string | null
          extra_seat_cents: number
          features: Json
          included_seats: number
          is_active: boolean
          is_public: boolean
          limits: Json
          name: string
          price_cents: number
          sort_order: number
          trial_days: number
          updated_at: string
        }
        Insert: {
          billing_interval?: "mensual" | "anual"
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          extra_seat_cents?: number
          features?: Json
          included_seats?: number
          is_active?: boolean
          is_public?: boolean
          limits?: Json
          name: string
          price_cents: number
          sort_order?: number
          trial_days?: number
          updated_at?: string
        }
        Update: {
          billing_interval?: "mensual" | "anual"
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          extra_seat_cents?: number
          features?: Json
          included_seats?: number
          is_active?: boolean
          is_public?: boolean
          limits?: Json
          name?: string
          price_cents?: number
          sort_order?: number
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      prescription_items: {
        Row: {
          created_at: string
          dose: string
          duration: string | null
          frequency: string
          id: string
          instructions: string | null
          medication: string
          medication_code: string | null
          prescription_id: string
          presentation: string | null
          quantity: string | null
          route: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dose: string
          duration?: string | null
          frequency: string
          id?: string
          instructions?: string | null
          medication: string
          medication_code?: string | null
          prescription_id: string
          presentation?: string | null
          quantity?: string | null
          route?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dose?: string
          duration?: string | null
          frequency?: string
          id?: string
          instructions?: string | null
          medication?: string
          medication_code?: string | null
          prescription_id?: string
          presentation?: string | null
          quantity?: string | null
          route?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_items_medication_code_fkey"
            columns: ["medication_code"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "prescription_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          amended_by: string | null
          created_at: string
          encounter_id: string | null
          folio: number | null
          id: string
          notes: string | null
          patient_id: string
          prescriber_id: string
          signed_at: string | null
          signed_by: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amended_by?: string | null
          created_at?: string
          encounter_id?: string | null
          folio?: number | null
          id?: string
          notes?: string | null
          patient_id: string
          prescriber_id: string
          signed_at?: string | null
          signed_by?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amended_by?: string | null
          created_at?: string
          encounter_id?: string | null
          folio?: number | null
          id?: string
          notes?: string | null
          patient_id?: string
          prescriber_id?: string
          signed_at?: string | null
          signed_by?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_amended_by_fkey"
            columns: ["amended_by"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_prescriber_id_fkey"
            columns: ["prescriber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_signed_by_fkey"
            columns: ["signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          disabled_at: string | null
          email: string
          full_name: string
          id: string
          last_seen_at: string | null
          license_country: string | null
          license_number: string | null
          locale: string
          mfa_enrolled_at: string | null
          phone: string | null
          specialty: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          disabled_at?: string | null
          email: string
          full_name: string
          id: string
          last_seen_at?: string | null
          license_country?: string | null
          license_number?: string | null
          locale?: string
          mfa_enrolled_at?: string | null
          phone?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          disabled_at?: string | null
          email?: string
          full_name?: string
          id?: string
          last_seen_at?: string | null
          license_country?: string | null
          license_number?: string | null
          locale?: string
          mfa_enrolled_at?: string | null
          phone?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      provider_schedules: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          location_id: string | null
          provider_id: string
          slot_minutes: number
          starts_at: string
          tenant_id: string
          updated_at: string
          valid_from: string
          valid_to: string | null
          weekday: number
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          location_id?: string | null
          provider_id: string
          slot_minutes?: number
          starts_at: string
          tenant_id: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
          weekday: number
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          location_id?: string | null
          provider_id?: string
          slot_minutes?: number
          starts_at?: string
          tenant_id?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "provider_schedules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_schedules_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_schedules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          bucket: string
          hits: number
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          window_start: string
        }
        Update: {
          bucket?: string
          hits?: number
          window_start?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_key: string
          role:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
        }
        Insert: {
          permission_key: string
          role:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
        }
        Update: {
          permission_key?: string
          role?:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      schedule_exceptions: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          is_available: boolean
          provider_id: string | null
          reason: string | null
          starts_at: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          is_available?: boolean
          provider_id?: string | null
          reason?: string | null
          starts_at: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          is_available?: boolean
          provider_id?: string | null
          reason?: string | null
          starts_at?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_exceptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          grace_until: string | null
          id: string
          plan_code: string
          provider: "payphone" | "kushki" | "manual"
          provider_customer_id: string | null
          provider_subscription_id: string | null
          seats: number
          status: "trial" | "activa" | "vencida" | "suspendida" | "cancelada"
          tenant_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          grace_until?: string | null
          id?: string
          plan_code: string
          provider?: "payphone" | "kushki" | "manual"
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          seats?: number
          status?: "trial" | "activa" | "vencida" | "suspendida" | "cancelada"
          tenant_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          grace_until?: string | null
          id?: string
          plan_code?: string
          provider?: "payphone" | "kushki" | "manual"
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          seats?: number
          status?: "trial" | "activa" | "vencida" | "suspendida" | "cancelada"
          tenant_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_counters: {
        Row: {
          counter: string
          tenant_id: string
          value: number
        }
        Insert: {
          counter: string
          tenant_id: string
          value?: number
        }
        Update: {
          counter?: string
          tenant_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          access_model: "open" | "care_team"
          commercial_name: string | null
          country: string
          created_at: string
          deleted_at: string | null
          dpo_email: string | null
          dpo_phone: string | null
          id: string
          kind:
            | "hospital"
            | "clinica"
            | "consultorio"
            | "laboratorio"
            | "centro_diagnostico"
          legal_name: string
          locale: string
          settings: Json
          slug: string
          status: "trialing" | "active" | "past_due" | "suspended" | "cancelled"
          tax_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          access_model?: "open" | "care_team"
          commercial_name?: string | null
          country?: string
          created_at?: string
          deleted_at?: string | null
          dpo_email?: string | null
          dpo_phone?: string | null
          id?: string
          kind?:
            | "hospital"
            | "clinica"
            | "consultorio"
            | "laboratorio"
            | "centro_diagnostico"
          legal_name: string
          locale?: string
          settings?: Json
          slug: string
          status?:
            | "trialing"
            | "active"
            | "past_due"
            | "suspended"
            | "cancelled"
          tax_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          access_model?: "open" | "care_team"
          commercial_name?: string | null
          country?: string
          created_at?: string
          deleted_at?: string | null
          dpo_email?: string | null
          dpo_phone?: string | null
          id?: string
          kind?:
            | "hospital"
            | "clinica"
            | "consultorio"
            | "laboratorio"
            | "centro_diagnostico"
          legal_name?: string
          locale?: string
          settings?: Json
          slug?: string
          status?:
            | "trialing"
            | "active"
            | "past_due"
            | "suspended"
            | "cancelled"
          tax_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      vitals: {
        Row: {
          bmi: number | null
          created_at: string
          diastolic_bp: number | null
          encounter_id: string | null
          glucose_mgdl: number | null
          heart_rate: number | null
          height_cm: number | null
          id: string
          measured_at: string
          oxygen_saturation: number | null
          pain_score: number | null
          patient_id: string
          recorded_by: string
          respiratory_rate: number | null
          systolic_bp: number | null
          temperature_c: number | null
          tenant_id: string
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          bmi?: number | null
          created_at?: string
          diastolic_bp?: number | null
          encounter_id?: string | null
          glucose_mgdl?: number | null
          heart_rate?: number | null
          height_cm?: number | null
          id?: string
          measured_at?: string
          oxygen_saturation?: number | null
          pain_score?: number | null
          patient_id: string
          recorded_by: string
          respiratory_rate?: number | null
          systolic_bp?: number | null
          temperature_c?: number | null
          tenant_id: string
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          bmi?: number | null
          created_at?: string
          diastolic_bp?: number | null
          encounter_id?: string | null
          glucose_mgdl?: number | null
          heart_rate?: number | null
          height_cm?: number | null
          id?: string
          measured_at?: string
          oxygen_saturation?: number | null
          pain_score?: number | null
          patient_id?: string
          recorded_by?: string
          respiratory_rate?: number | null
          systolic_bp?: number | null
          temperature_c?: number | null
          tenant_id?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vitals_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitals_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitals_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          context: Json
          created_at: string
          failed_identifications: number
          id: string
          last_message_at: string
          patient_id: string | null
          state:
            | "inicio"
            | "identificando"
            | "menu"
            | "eligiendo_medico"
            | "eligiendo_fecha"
            | "eligiendo_hora"
            | "confirmando"
            | "finalizada"
            | "escalada_humano"
          tenant_id: string
          updated_at: string
          wa_phone: string
          window_expires_at: string
        }
        Insert: {
          context?: Json
          created_at?: string
          failed_identifications?: number
          id?: string
          last_message_at?: string
          patient_id?: string | null
          state?:
            | "inicio"
            | "identificando"
            | "menu"
            | "eligiendo_medico"
            | "eligiendo_fecha"
            | "eligiendo_hora"
            | "confirmando"
            | "finalizada"
            | "escalada_humano"
          tenant_id: string
          updated_at?: string
          wa_phone: string
          window_expires_at?: string
        }
        Update: {
          context?: Json
          created_at?: string
          failed_identifications?: number
          id?: string
          last_message_at?: string
          patient_id?: string | null
          state?:
            | "inicio"
            | "identificando"
            | "menu"
            | "eligiendo_medico"
            | "eligiendo_fecha"
            | "eligiendo_hora"
            | "confirmando"
            | "finalizada"
            | "escalada_humano"
          tenant_id?: string
          updated_at?: string
          wa_phone?: string
          window_expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          direction: "entrante" | "saliente"
          error_code: string | null
          error_detail: string | null
          id: string
          message_type: string
          payload: Json
          status: string | null
          tenant_id: string
          updated_at: string
          wa_message_id: string | null
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          direction: "entrante" | "saliente"
          error_code?: string | null
          error_detail?: string | null
          id?: string
          message_type?: string
          payload?: Json
          status?: string | null
          tenant_id: string
          updated_at?: string
          wa_message_id?: string | null
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          direction?: "entrante" | "saliente"
          error_code?: string | null
          error_detail?: string | null
          id?: string
          message_type?: string
          payload?: Json
          status?: string | null
          tenant_id?: string
          updated_at?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      available_slots: {
        Args: {
          p_from: string
          p_location_id?: string
          p_provider_id: string
          p_tenant_id: string
          p_to: string
        }
        Returns: {
          ends_at: string
          location_id: string
          starts_at: string
        }[]
      }
      break_glass: {
        Args: { p_patient_id: string; p_reason: string }
        Returns: string
      }
      buscar_icd10: {
        Args: { p_limite?: number; p_termino: string }
        Returns: {
          chapter: string
          code: string
          display: string
          is_common: boolean
        }[]
      }
      buscar_medicamento: {
        Args: { p_limite?: number; p_termino: string }
        Returns: {
          allergen_keys: string[]
          brand_names: string
          category: string
          code: string
          generic_name: string
          presentations: string[]
          usual_dose: string
          usual_frequency: string
        }[]
      }
      claim_documents_for_scan: {
        Args: { p_limite?: number }
        Returns: {
          id: string
          mime_type: string
          patient_id: string
          scan_attempts: number
          size_bytes: number
          storage_path: string
          tenant_id: string
        }[]
      }
      consume_rate_limit: {
        Args: { p_bucket: string; p_limit: number; p_window_secs?: number }
        Returns: {
          allowed: boolean
          remaining: number
          resets_at: string
        }[]
      }
      create_tenant: {
        Args: {
          p_commercial_name?: string
          p_kind?:
            | "hospital"
            | "clinica"
            | "consultorio"
            | "laboratorio"
            | "centro_diagnostico"
          p_legal_name: string
          p_slug: string
          p_tax_id?: string
          p_timezone?: string
        }
        Returns: string
      }
      estado_cola_antivirus: {
        Args: { p_tenant_id: string }
        Returns: {
          con_error: number
          infectados: number
          mas_antiguo: string
          pendientes: number
        }[]
      }
      invite_member: {
        Args: {
          p_email: string
          p_role:
            | "owner"
            | "admin"
            | "physician"
            | "nurse"
            | "receptionist"
            | "billing"
            | "auditor"
          p_tenant_id: string
        }
        Returns: {
          invitation_id: string
          token: string
        }[]
      }
      record_audit: {
        Args: {
          p_action: string
          p_metadata?: Json
          p_patient_id?: string
          p_resource_id?: string
          p_resource_type: string
          p_summary?: string
          p_tenant_id?: string
        }
        Returns: number
      }
      record_auth_event: {
        Args: {
          p_action: string
          p_detail?: Json
          p_email: string
          p_ip?: string
          p_succeeded: boolean
          p_user_agent?: string
        }
        Returns: undefined
      }
      record_scan_result: {
        Args: {
          p_detail?: string
          p_document_id: string
          p_engine: string
          p_signature_version?: string
          p_status: string
        }
        Returns: undefined
      }
      sign_clinical_record: {
        Args: { p_id: string; p_table: string }
        Returns: undefined
      }
      verificar_alergias: {
        Args: { p_medication_codes: string[]; p_patient_id: string }
        Returns: {
          allergy_id: string
          allergy_reaction: string
          allergy_severity: "leve" | "moderada" | "severa" | "mortal"
          allergy_substance: string
          match_kind: string
          medication_code: string
          medication_name: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

