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
      acoes_saude: {
        Row: {
          capacidade_maxima: number | null
          categoria: Database["public"]["Enums"]["categoria_acao_saude"]
          created_at: string
          criado_por: string
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          empresa_id: string | null
          id: string
          local: string | null
          material_nome: string | null
          material_url: string | null
          observacoes: string | null
          status: Database["public"]["Enums"]["status_acao_saude"]
          tipo: Database["public"]["Enums"]["tipo_acao_saude"]
          titulo: string
          updated_at: string
        }
        Insert: {
          capacidade_maxima?: number | null
          categoria: Database["public"]["Enums"]["categoria_acao_saude"]
          created_at?: string
          criado_por: string
          data_fim?: string | null
          data_inicio: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          local?: string | null
          material_nome?: string | null
          material_url?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_acao_saude"]
          tipo: Database["public"]["Enums"]["tipo_acao_saude"]
          titulo: string
          updated_at?: string
        }
        Update: {
          capacidade_maxima?: number | null
          categoria?: Database["public"]["Enums"]["categoria_acao_saude"]
          created_at?: string
          criado_por?: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          local?: string | null
          material_nome?: string | null
          material_url?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_acao_saude"]
          tipo?: Database["public"]["Enums"]["tipo_acao_saude"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acoes_saude_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_audit_logs: {
        Row: {
          action: string
          created_at: string
          duration_ms: number | null
          empresa_id: string
          id: string
          input_summary: string | null
          job_id: string | null
          model_used: string | null
          output_summary: string | null
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          duration_ms?: number | null
          empresa_id: string
          id?: string
          input_summary?: string | null
          job_id?: string | null
          model_used?: string | null
          output_summary?: string | null
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          duration_ms?: number | null
          empresa_id?: string
          id?: string
          input_summary?: string | null
          job_id?: string | null
          model_used?: string | null
          output_summary?: string | null
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_audit_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_audit_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficiarios: {
        Row: {
          bairro: string | null
          cargo: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          cpf: string
          created_at: string
          criado_por: string
          data_exclusao: string | null
          data_inclusao: string
          data_nascimento: string
          departamento: string | null
          email: string | null
          empresa_id: string
          endereco: string | null
          grau_parentesco: Database["public"]["Enums"]["grau_parentesco"] | null
          id: string
          matricula: string | null
          motivo_exclusao: string | null
          nome_completo: string
          numero: string | null
          plano_odonto: boolean | null
          plano_saude: boolean | null
          plano_vida: boolean | null
          sexo: string | null
          status: Database["public"]["Enums"]["status_beneficiario"]
          telefone: string | null
          tipo: Database["public"]["Enums"]["tipo_beneficiario"]
          titular_id: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cargo?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf: string
          created_at?: string
          criado_por: string
          data_exclusao?: string | null
          data_inclusao?: string
          data_nascimento: string
          departamento?: string | null
          email?: string | null
          empresa_id: string
          endereco?: string | null
          grau_parentesco?:
            | Database["public"]["Enums"]["grau_parentesco"]
            | null
          id?: string
          matricula?: string | null
          motivo_exclusao?: string | null
          nome_completo: string
          numero?: string | null
          plano_odonto?: boolean | null
          plano_saude?: boolean | null
          plano_vida?: boolean | null
          sexo?: string | null
          status?: Database["public"]["Enums"]["status_beneficiario"]
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_beneficiario"]
          titular_id?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cargo?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string
          created_at?: string
          criado_por?: string
          data_exclusao?: string | null
          data_inclusao?: string
          data_nascimento?: string
          departamento?: string | null
          email?: string | null
          empresa_id?: string
          endereco?: string | null
          grau_parentesco?:
            | Database["public"]["Enums"]["grau_parentesco"]
            | null
          id?: string
          matricula?: string | null
          motivo_exclusao?: string | null
          nome_completo?: string
          numero?: string | null
          plano_odonto?: boolean | null
          plano_saude?: boolean | null
          plano_vida?: boolean | null
          sexo?: string | null
          status?: Database["public"]["Enums"]["status_beneficiario"]
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_beneficiario"]
          titular_id?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "beneficiarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficiarios_titular_id_fkey"
            columns: ["titular_id"]
            isOneToOne: false
            referencedRelation: "beneficiarios"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          arquivo_nome: string
          arquivo_url: string
          assinado: boolean
          contrato_pai_id: string | null
          created_at: string
          criado_por: string
          data_assinatura: string | null
          data_fim: string
          data_inicio: string
          empresa_id: string
          id: string
          numero_contrato: string | null
          observacoes: string | null
          status: Database["public"]["Enums"]["status_contrato"]
          tipo: Database["public"]["Enums"]["tipo_documento_contrato"]
          titulo: string
          updated_at: string
          valor_mensal: number | null
          versao: number
        }
        Insert: {
          arquivo_nome: string
          arquivo_url: string
          assinado?: boolean
          contrato_pai_id?: string | null
          created_at?: string
          criado_por: string
          data_assinatura?: string | null
          data_fim: string
          data_inicio: string
          empresa_id: string
          id?: string
          numero_contrato?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_contrato"]
          tipo?: Database["public"]["Enums"]["tipo_documento_contrato"]
          titulo: string
          updated_at?: string
          valor_mensal?: number | null
          versao?: number
        }
        Update: {
          arquivo_nome?: string
          arquivo_url?: string
          assinado?: boolean
          contrato_pai_id?: string | null
          created_at?: string
          criado_por?: string
          data_assinatura?: string | null
          data_fim?: string
          data_inicio?: string
          empresa_id?: string
          id?: string
          numero_contrato?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_contrato"]
          tipo?: Database["public"]["Enums"]["tipo_documento_contrato"]
          titulo?: string
          updated_at?: string
          valor_mensal?: number | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_contrato_pai_id_fkey"
            columns: ["contrato_pai_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      demandas: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          created_at: string
          criado_por: string
          descricao: string | null
          empresa_id: string
          id: string
          prazo: string | null
          prioridade: Database["public"]["Enums"]["prioridade_demanda"]
          responsavel_id: string | null
          status: Database["public"]["Enums"]["status_demanda"]
          tipo: Database["public"]["Enums"]["tipo_demanda"]
          titulo: string
          updated_at: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          created_at?: string
          criado_por: string
          descricao?: string | null
          empresa_id: string
          id?: string
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_demanda"]
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_demanda"]
          tipo: Database["public"]["Enums"]["tipo_demanda"]
          titulo: string
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          created_at?: string
          criado_por?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_demanda"]
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_demanda"]
          tipo?: Database["public"]["Enums"]["tipo_demanda"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demandas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      demandas_historico: {
        Row: {
          comentario: string | null
          created_at: string
          criado_por: string
          demanda_id: string
          id: string
          status_anterior: Database["public"]["Enums"]["status_demanda"] | null
          status_novo: Database["public"]["Enums"]["status_demanda"] | null
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          criado_por: string
          demanda_id: string
          id?: string
          status_anterior?: Database["public"]["Enums"]["status_demanda"] | null
          status_novo?: Database["public"]["Enums"]["status_demanda"] | null
        }
        Update: {
          comentario?: string | null
          created_at?: string
          criado_por?: string
          demanda_id?: string
          id?: string
          status_anterior?: Database["public"]["Enums"]["status_demanda"] | null
          status_novo?: Database["public"]["Enums"]["status_demanda"] | null
        }
        Relationships: [
          {
            foreignKeyName: "demandas_historico_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativo: boolean
          cnpj: string
          contato_email: string | null
          contato_telefone: string | null
          created_at: string
          id: string
          nome: string
          razao_social: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj: string
          contato_email?: string | null
          contato_telefone?: string | null
          created_at?: string
          id?: string
          nome: string
          razao_social?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string
          contato_email?: string | null
          contato_telefone?: string | null
          created_at?: string
          id?: string
          nome?: string
          razao_social?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      faturamento: {
        Row: {
          categoria: Database["public"]["Enums"]["categoria_beneficio"]
          competencia: string
          created_at: string
          criado_por: string
          data_pagamento: string | null
          data_vencimento: string | null
          empresa_id: string
          id: string
          status: string
          total_dependentes: number
          total_titulares: number
          total_vidas: number
          updated_at: string
          valor_coparticipacao: number | null
          valor_mensalidade: number
          valor_reembolsos: number | null
          valor_total: number
        }
        Insert: {
          categoria: Database["public"]["Enums"]["categoria_beneficio"]
          competencia: string
          created_at?: string
          criado_por: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          empresa_id: string
          id?: string
          status?: string
          total_dependentes?: number
          total_titulares?: number
          total_vidas?: number
          updated_at?: string
          valor_coparticipacao?: number | null
          valor_mensalidade?: number
          valor_reembolsos?: number | null
          valor_total?: number
        }
        Update: {
          categoria?: Database["public"]["Enums"]["categoria_beneficio"]
          competencia?: string
          created_at?: string
          criado_por?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          empresa_id?: string
          id?: string
          status?: string
          total_dependentes?: number
          total_titulares?: number
          total_vidas?: number
          updated_at?: string
          valor_coparticipacao?: number | null
          valor_mensalidade?: number
          valor_reembolsos?: number | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "faturamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      import_job_rows: {
        Row: {
          created_at: string
          duplicate_of: string | null
          id: string
          job_id: string
          mapped_data: Json | null
          original_data: Json
          row_number: number
          status: Database["public"]["Enums"]["import_row_status"]
          validation_errors: Json | null
          validation_warnings: Json | null
        }
        Insert: {
          created_at?: string
          duplicate_of?: string | null
          id?: string
          job_id: string
          mapped_data?: Json | null
          original_data: Json
          row_number: number
          status?: Database["public"]["Enums"]["import_row_status"]
          validation_errors?: Json | null
          validation_warnings?: Json | null
        }
        Update: {
          created_at?: string
          duplicate_of?: string | null
          id?: string
          job_id?: string
          mapped_data?: Json | null
          original_data?: Json
          row_number?: number
          status?: Database["public"]["Enums"]["import_row_status"]
          validation_errors?: Json | null
          validation_warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_job_rows_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          ai_suggestions: Json | null
          ai_summary: string | null
          aprovado_por: string | null
          arquivo_nome: string
          arquivo_url: string
          column_mapping: Json | null
          created_at: string
          criado_por: string
          data_aprovacao: string | null
          data_type: Database["public"]["Enums"]["import_data_type"]
          duplicate_rows: number | null
          empresa_id: string
          error_rows: number | null
          id: string
          status: Database["public"]["Enums"]["import_job_status"]
          total_rows: number | null
          updated_at: string
          valid_rows: number | null
          warning_rows: number | null
        }
        Insert: {
          ai_suggestions?: Json | null
          ai_summary?: string | null
          aprovado_por?: string | null
          arquivo_nome: string
          arquivo_url: string
          column_mapping?: Json | null
          created_at?: string
          criado_por: string
          data_aprovacao?: string | null
          data_type: Database["public"]["Enums"]["import_data_type"]
          duplicate_rows?: number | null
          empresa_id: string
          error_rows?: number | null
          id?: string
          status?: Database["public"]["Enums"]["import_job_status"]
          total_rows?: number | null
          updated_at?: string
          valid_rows?: number | null
          warning_rows?: number | null
        }
        Update: {
          ai_suggestions?: Json | null
          ai_summary?: string | null
          aprovado_por?: string | null
          arquivo_nome?: string
          arquivo_url?: string
          column_mapping?: Json | null
          created_at?: string
          criado_por?: string
          data_aprovacao?: string | null
          data_type?: Database["public"]["Enums"]["import_data_type"]
          duplicate_rows?: number | null
          empresa_id?: string
          error_rows?: number | null
          id?: string
          status?: Database["public"]["Enums"]["import_job_status"]
          total_rows?: number | null
          updated_at?: string
          valid_rows?: number | null
          warning_rows?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      indicadores_saude: {
        Row: {
          acao_id: string
          created_at: string
          criado_por: string
          empresa_id: string
          id: string
          observacoes: string | null
          taxa_adesao: number | null
          total_convidados: number
          total_participantes: number
          updated_at: string
        }
        Insert: {
          acao_id: string
          created_at?: string
          criado_por: string
          empresa_id: string
          id?: string
          observacoes?: string | null
          taxa_adesao?: number | null
          total_convidados?: number
          total_participantes?: number
          updated_at?: string
        }
        Update: {
          acao_id?: string
          created_at?: string
          criado_por?: string
          empresa_id?: string
          id?: string
          observacoes?: string | null
          taxa_adesao?: number | null
          total_convidados?: number
          total_participantes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicadores_saude_acao_id_fkey"
            columns: ["acao_id"]
            isOneToOne: false
            referencedRelation: "acoes_saude"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicadores_saude_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_vidas: {
        Row: {
          aprovado_por: string | null
          arquivo_nome: string
          arquivo_url: string
          categoria: Database["public"]["Enums"]["categoria_beneficio"]
          created_at: string
          criado_por: string
          dados_json: Json | null
          data_processamento: string | null
          data_upload: string
          empresa_id: string
          id: string
          motivo_rejeicao: string | null
          observacoes: string | null
          registros_processados: number
          status: Database["public"]["Enums"]["status_movimentacao"]
          tipo: Database["public"]["Enums"]["tipo_movimentacao"]
          total_registros: number
          updated_at: string
        }
        Insert: {
          aprovado_por?: string | null
          arquivo_nome: string
          arquivo_url: string
          categoria: Database["public"]["Enums"]["categoria_beneficio"]
          created_at?: string
          criado_por: string
          dados_json?: Json | null
          data_processamento?: string | null
          data_upload?: string
          empresa_id: string
          id?: string
          motivo_rejeicao?: string | null
          observacoes?: string | null
          registros_processados?: number
          status?: Database["public"]["Enums"]["status_movimentacao"]
          tipo: Database["public"]["Enums"]["tipo_movimentacao"]
          total_registros?: number
          updated_at?: string
        }
        Update: {
          aprovado_por?: string | null
          arquivo_nome?: string
          arquivo_url?: string
          categoria?: Database["public"]["Enums"]["categoria_beneficio"]
          created_at?: string
          criado_por?: string
          dados_json?: Json | null
          data_processamento?: string | null
          data_upload?: string
          empresa_id?: string
          id?: string
          motivo_rejeicao?: string | null
          observacoes?: string | null
          registros_processados?: number
          status?: Database["public"]["Enums"]["status_movimentacao"]
          tipo?: Database["public"]["Enums"]["tipo_movimentacao"]
          total_registros?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          cargo: string | null
          created_at: string
          email: string
          empresa_id: string | null
          id: string
          nome_completo: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          email: string
          empresa_id?: string | null
          id: string
          nome_completo: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          email?: string
          empresa_id?: string | null
          id?: string
          nome_completo?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistralidade: {
        Row: {
          categoria: Database["public"]["Enums"]["categoria_beneficio"]
          competencia: string
          created_at: string
          criado_por: string
          empresa_id: string
          id: string
          indice_sinistralidade: number | null
          quantidade_sinistros: number
          sinistros_consultas: number | null
          sinistros_exames: number | null
          sinistros_internacoes: number | null
          sinistros_outros: number | null
          sinistros_procedimentos: number | null
          updated_at: string
          valor_premio: number
          valor_sinistros: number
        }
        Insert: {
          categoria: Database["public"]["Enums"]["categoria_beneficio"]
          competencia: string
          created_at?: string
          criado_por: string
          empresa_id: string
          id?: string
          indice_sinistralidade?: number | null
          quantidade_sinistros?: number
          sinistros_consultas?: number | null
          sinistros_exames?: number | null
          sinistros_internacoes?: number | null
          sinistros_outros?: number | null
          sinistros_procedimentos?: number | null
          updated_at?: string
          valor_premio?: number
          valor_sinistros?: number
        }
        Update: {
          categoria?: Database["public"]["Enums"]["categoria_beneficio"]
          competencia?: string
          created_at?: string
          criado_por?: string
          empresa_id?: string
          id?: string
          indice_sinistralidade?: number | null
          quantidade_sinistros?: number
          sinistros_consultas?: number | null
          sinistros_exames?: number | null
          sinistros_internacoes?: number | null
          sinistros_outros?: number | null
          sinistros_procedimentos?: number | null
          updated_at?: string
          valor_premio?: number
          valor_sinistros?: number
        }
        Relationships: [
          {
            foreignKeyName: "sinistralidade_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistros_vida: {
        Row: {
          beneficiario_cpf: string | null
          beneficiario_nome: string
          created_at: string
          criado_por: string
          data_comunicacao: string | null
          data_ocorrencia: string
          empresa_id: string
          id: string
          observacoes: string | null
          status: string
          tipo_sinistro: string
          updated_at: string
          valor_indenizacao: number | null
        }
        Insert: {
          beneficiario_cpf?: string | null
          beneficiario_nome: string
          created_at?: string
          criado_por: string
          data_comunicacao?: string | null
          data_ocorrencia: string
          empresa_id: string
          id?: string
          observacoes?: string | null
          status?: string
          tipo_sinistro: string
          updated_at?: string
          valor_indenizacao?: number | null
        }
        Update: {
          beneficiario_cpf?: string | null
          beneficiario_nome?: string
          created_at?: string
          criado_por?: string
          data_comunicacao?: string | null
          data_ocorrencia?: string
          empresa_id?: string
          id?: string
          observacoes?: string | null
          status?: string
          tipo_sinistro?: string
          updated_at?: string
          valor_indenizacao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sinistros_vida_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
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
          role: Database["public"]["Enums"]["app_role"]
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
      get_user_empresa_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin_vizio" | "admin_empresa" | "rh_gestor" | "visualizador"
      categoria_acao_saude:
        | "vacinacao"
        | "checkup"
        | "bem_estar"
        | "nutricional"
        | "atividade_fisica"
        | "saude_mental"
        | "prevencao"
        | "outro"
      categoria_beneficio: "saude" | "vida" | "odonto"
      grau_parentesco: "conjuge" | "filho" | "pai" | "mae" | "outro"
      import_data_type:
        | "beneficiarios"
        | "faturamento"
        | "sinistralidade"
        | "movimentacoes"
        | "contratos"
      import_job_status:
        | "pending"
        | "processing"
        | "ready_for_review"
        | "approved"
        | "rejected"
        | "completed"
        | "failed"
      import_row_status: "valid" | "warning" | "error" | "duplicate" | "updated"
      prioridade_demanda: "baixa" | "media" | "alta" | "urgente"
      status_acao_saude:
        | "planejada"
        | "em_andamento"
        | "concluida"
        | "cancelada"
      status_beneficiario: "ativo" | "inativo" | "suspenso"
      status_contrato:
        | "ativo"
        | "vencido"
        | "em_renovacao"
        | "suspenso"
        | "cancelado"
      status_demanda:
        | "pendente"
        | "em_andamento"
        | "aguardando_documentacao"
        | "concluido"
        | "cancelado"
      status_movimentacao: "pendente" | "aprovada" | "rejeitada" | "processada"
      tipo_acao_saude: "campanha" | "programa" | "evento" | "treinamento"
      tipo_beneficiario: "titular" | "dependente"
      tipo_demanda:
        | "certificado"
        | "carteirinha"
        | "alteracao_cadastral"
        | "reembolso"
        | "autorizacao"
        | "agendamento"
        | "outro"
      tipo_documento_contrato: "contrato" | "aditivo" | "renovacao"
      tipo_movimentacao:
        | "inclusao"
        | "exclusao"
        | "alteracao_cadastral"
        | "mudanca_plano"
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
      app_role: ["admin_vizio", "admin_empresa", "rh_gestor", "visualizador"],
      categoria_acao_saude: [
        "vacinacao",
        "checkup",
        "bem_estar",
        "nutricional",
        "atividade_fisica",
        "saude_mental",
        "prevencao",
        "outro",
      ],
      categoria_beneficio: ["saude", "vida", "odonto"],
      grau_parentesco: ["conjuge", "filho", "pai", "mae", "outro"],
      import_data_type: [
        "beneficiarios",
        "faturamento",
        "sinistralidade",
        "movimentacoes",
        "contratos",
      ],
      import_job_status: [
        "pending",
        "processing",
        "ready_for_review",
        "approved",
        "rejected",
        "completed",
        "failed",
      ],
      import_row_status: ["valid", "warning", "error", "duplicate", "updated"],
      prioridade_demanda: ["baixa", "media", "alta", "urgente"],
      status_acao_saude: [
        "planejada",
        "em_andamento",
        "concluida",
        "cancelada",
      ],
      status_beneficiario: ["ativo", "inativo", "suspenso"],
      status_contrato: [
        "ativo",
        "vencido",
        "em_renovacao",
        "suspenso",
        "cancelado",
      ],
      status_demanda: [
        "pendente",
        "em_andamento",
        "aguardando_documentacao",
        "concluido",
        "cancelado",
      ],
      status_movimentacao: ["pendente", "aprovada", "rejeitada", "processada"],
      tipo_acao_saude: ["campanha", "programa", "evento", "treinamento"],
      tipo_beneficiario: ["titular", "dependente"],
      tipo_demanda: [
        "certificado",
        "carteirinha",
        "alteracao_cadastral",
        "reembolso",
        "autorizacao",
        "agendamento",
        "outro",
      ],
      tipo_documento_contrato: ["contrato", "aditivo", "renovacao"],
      tipo_movimentacao: [
        "inclusao",
        "exclusao",
        "alteracao_cadastral",
        "mudanca_plano",
      ],
    },
  },
} as const
