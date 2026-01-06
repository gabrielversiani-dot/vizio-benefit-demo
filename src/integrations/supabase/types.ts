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
          campanha_mes: string | null
          capacidade_maxima: number | null
          categoria: Database["public"]["Enums"]["categoria_acao_saude"]
          created_at: string
          criado_por: string
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          empresa_id: string | null
          filial_id: string | null
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          local: string | null
          material_nome: string | null
          material_url: string | null
          observacoes: string | null
          publico_alvo: string | null
          responsavel: string | null
          status: Database["public"]["Enums"]["status_acao_saude"]
          tipo: Database["public"]["Enums"]["tipo_acao_saude"]
          titulo: string
          updated_at: string
          visibilidade: Database["public"]["Enums"]["visibilidade_acao"]
        }
        Insert: {
          campanha_mes?: string | null
          capacidade_maxima?: number | null
          categoria: Database["public"]["Enums"]["categoria_acao_saude"]
          created_at?: string
          criado_por: string
          data_fim?: string | null
          data_inicio: string
          descricao?: string | null
          empresa_id?: string | null
          filial_id?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          local?: string | null
          material_nome?: string | null
          material_url?: string | null
          observacoes?: string | null
          publico_alvo?: string | null
          responsavel?: string | null
          status?: Database["public"]["Enums"]["status_acao_saude"]
          tipo: Database["public"]["Enums"]["tipo_acao_saude"]
          titulo: string
          updated_at?: string
          visibilidade?: Database["public"]["Enums"]["visibilidade_acao"]
        }
        Update: {
          campanha_mes?: string | null
          capacidade_maxima?: number | null
          categoria?: Database["public"]["Enums"]["categoria_acao_saude"]
          created_at?: string
          criado_por?: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          empresa_id?: string | null
          filial_id?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          local?: string | null
          material_nome?: string | null
          material_url?: string | null
          observacoes?: string | null
          publico_alvo?: string | null
          responsavel?: string | null
          status?: Database["public"]["Enums"]["status_acao_saude"]
          tipo?: Database["public"]["Enums"]["tipo_acao_saude"]
          titulo?: string
          updated_at?: string
          visibilidade?: Database["public"]["Enums"]["visibilidade_acao"]
        }
        Relationships: [
          {
            foreignKeyName: "acoes_saude_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acoes_saude_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "faturamento_entidades"
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
      ai_recomendacoes: {
        Row: {
          categoria: string
          created_at: string
          created_by: string | null
          descricao: string
          empresa_id: string
          evidencias: Json | null
          id: string
          periodo_fim: string
          periodo_inicio: string
          severidade: string
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          categoria?: string
          created_at?: string
          created_by?: string | null
          descricao: string
          empresa_id: string
          evidencias?: Json | null
          id?: string
          periodo_fim: string
          periodo_inicio: string
          severidade?: string
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          created_by?: string | null
          descricao?: string
          empresa_id?: string
          evidencias?: Json | null
          id?: string
          periodo_fim?: string
          periodo_inicio?: string
          severidade?: string
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recomendacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
      contrato_documentos: {
        Row: {
          arquivo_nome: string
          contrato_id: string
          created_at: string
          empresa_id: string
          id: string
          mime_type: string
          storage_bucket: string
          storage_path: string
          tamanho_bytes: number
          tipo_documento: string
          uploaded_by: string | null
          versao: number
        }
        Insert: {
          arquivo_nome: string
          contrato_id: string
          created_at?: string
          empresa_id: string
          id?: string
          mime_type: string
          storage_bucket?: string
          storage_path: string
          tamanho_bytes: number
          tipo_documento?: string
          uploaded_by?: string | null
          versao?: number
        }
        Update: {
          arquivo_nome?: string
          contrato_id?: string
          created_at?: string
          empresa_id?: string
          id?: string
          mime_type?: string
          storage_bucket?: string
          storage_path?: string
          tamanho_bytes?: number
          tipo_documento?: string
          uploaded_by?: string | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "contrato_documentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          arquivo_nome: string
          arquivo_url: string
          assinado: boolean
          competencia_referencia: string | null
          contrato_pai_id: string | null
          created_at: string
          criado_por: string
          data_assinatura: string | null
          data_fim: string
          data_inicio: string
          empresa_id: string
          filial_id: string | null
          id: string
          numero_contrato: string | null
          observacoes: string | null
          operadora: string | null
          produto: string | null
          reajuste_percentual: number | null
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
          competencia_referencia?: string | null
          contrato_pai_id?: string | null
          created_at?: string
          criado_por: string
          data_assinatura?: string | null
          data_fim: string
          data_inicio: string
          empresa_id: string
          filial_id?: string | null
          id?: string
          numero_contrato?: string | null
          observacoes?: string | null
          operadora?: string | null
          produto?: string | null
          reajuste_percentual?: number | null
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
          competencia_referencia?: string | null
          contrato_pai_id?: string | null
          created_at?: string
          criado_por?: string
          data_assinatura?: string | null
          data_fim?: string
          data_inicio?: string
          empresa_id?: string
          filial_id?: string | null
          id?: string
          numero_contrato?: string | null
          observacoes?: string | null
          operadora?: string | null
          produto?: string | null
          reajuste_percentual?: number | null
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
          {
            foreignKeyName: "contratos_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "faturamento_entidades"
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
          raw_payload: Json | null
          rd_deal_id: string | null
          rd_deal_name: string | null
          rd_organization_id: string | null
          rd_task_id: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          source: string
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
          raw_payload?: Json | null
          rd_deal_id?: string | null
          rd_deal_name?: string | null
          rd_organization_id?: string | null
          rd_task_id?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          source?: string
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
          raw_payload?: Json | null
          rd_deal_id?: string | null
          rd_deal_name?: string | null
          rd_organization_id?: string | null
          rd_task_id?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          source?: string
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
          descricao: string | null
          empresa_id: string | null
          id: string
          status_anterior: Database["public"]["Enums"]["status_demanda"] | null
          status_novo: Database["public"]["Enums"]["status_demanda"] | null
          tipo_evento: string | null
          usuario_nome: string | null
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          criado_por: string
          demanda_id: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          status_anterior?: Database["public"]["Enums"]["status_demanda"] | null
          status_novo?: Database["public"]["Enums"]["status_demanda"] | null
          tipo_evento?: string | null
          usuario_nome?: string | null
        }
        Update: {
          comentario?: string | null
          created_at?: string
          criado_por?: string
          demanda_id?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          status_anterior?: Database["public"]["Enums"]["status_demanda"] | null
          status_novo?: Database["public"]["Enums"]["status_demanda"] | null
          tipo_evento?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demandas_historico_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_historico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_rd_organizacoes: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          rd_organization_id: string
          rd_organization_name: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          rd_organization_id: string
          rd_organization_name?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          rd_organization_id?: string
          rd_organization_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_rd_organizacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
          is_demo: boolean
          nome: string
          razao_social: string | null
          rd_station_enabled: boolean
          rd_station_last_sync: string | null
          rd_station_org_name_snapshot: string | null
          rd_station_organization_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj: string
          contato_email?: string | null
          contato_telefone?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          nome: string
          razao_social?: string | null
          rd_station_enabled?: boolean
          rd_station_last_sync?: string | null
          rd_station_org_name_snapshot?: string | null
          rd_station_organization_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string
          contato_email?: string | null
          contato_telefone?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          nome?: string
          razao_social?: string | null
          rd_station_enabled?: boolean
          rd_station_last_sync?: string | null
          rd_station_org_name_snapshot?: string | null
          rd_station_organization_id?: string | null
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
      faturamento_documentos: {
        Row: {
          created_at: string
          faturamento_id: string
          filename: string
          id: string
          mime_type: string
          storage_path: string
          tamanho_bytes: number
          tipo: Database["public"]["Enums"]["faturamento_documento_tipo"]
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          faturamento_id: string
          filename: string
          id?: string
          mime_type: string
          storage_path: string
          tamanho_bytes: number
          tipo: Database["public"]["Enums"]["faturamento_documento_tipo"]
          uploaded_by: string
        }
        Update: {
          created_at?: string
          faturamento_id?: string
          filename?: string
          id?: string
          mime_type?: string
          storage_path?: string
          tamanho_bytes?: number
          tipo?: Database["public"]["Enums"]["faturamento_documento_tipo"]
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "faturamento_documentos_faturamento_id_fkey"
            columns: ["faturamento_id"]
            isOneToOne: false
            referencedRelation: "faturamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturamento_documentos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      faturamento_entidades: {
        Row: {
          ativo: boolean
          cnpj: string | null
          created_at: string
          empresa_id: string
          id: string
          nome: string
          tipo: Database["public"]["Enums"]["faturamento_entidade_tipo"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          tipo: Database["public"]["Enums"]["faturamento_entidade_tipo"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          tipo?: Database["public"]["Enums"]["faturamento_entidade_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faturamento_entidades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      faturamento_subfaturas: {
        Row: {
          created_at: string
          descricao: string | null
          entidade_id: string | null
          faturamento_id: string
          id: string
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          entidade_id?: string | null
          faturamento_id: string
          id?: string
          updated_at?: string
          valor: number
        }
        Update: {
          created_at?: string
          descricao?: string | null
          entidade_id?: string | null
          faturamento_id?: string
          id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "faturamento_subfaturas_entidade_id_fkey"
            columns: ["entidade_id"]
            isOneToOne: false
            referencedRelation: "faturamento_entidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturamento_subfaturas_faturamento_id_fkey"
            columns: ["faturamento_id"]
            isOneToOne: false
            referencedRelation: "faturamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      faturamentos: {
        Row: {
          competencia: string
          created_at: string
          criado_por: string
          empresa_id: string
          filial_id: string | null
          id: string
          observacao: string | null
          pago_em: string | null
          produto: Database["public"]["Enums"]["faturamento_produto"]
          status: Database["public"]["Enums"]["faturamento_status"]
          updated_at: string
          valor_total: number
          vencimento: string
        }
        Insert: {
          competencia: string
          created_at?: string
          criado_por: string
          empresa_id: string
          filial_id?: string | null
          id?: string
          observacao?: string | null
          pago_em?: string | null
          produto: Database["public"]["Enums"]["faturamento_produto"]
          status?: Database["public"]["Enums"]["faturamento_status"]
          updated_at?: string
          valor_total: number
          vencimento: string
        }
        Update: {
          competencia?: string
          created_at?: string
          criado_por?: string
          empresa_id?: string
          filial_id?: string | null
          id?: string
          observacao?: string | null
          pago_em?: string | null
          produto?: Database["public"]["Enums"]["faturamento_produto"]
          status?: Database["public"]["Enums"]["faturamento_status"]
          updated_at?: string
          valor_total?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "faturamentos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturamentos_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "faturamento_entidades"
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
          applied_at: string | null
          applied_by: string | null
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
          parent_job_id: string | null
          status: Database["public"]["Enums"]["import_job_status"]
          total_rows: number | null
          updated_at: string
          valid_rows: number | null
          warning_rows: number | null
        }
        Insert: {
          ai_suggestions?: Json | null
          ai_summary?: string | null
          applied_at?: string | null
          applied_by?: string | null
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
          parent_job_id?: string | null
          status?: Database["public"]["Enums"]["import_job_status"]
          total_rows?: number | null
          updated_at?: string
          valid_rows?: number | null
          warning_rows?: number | null
        }
        Update: {
          ai_suggestions?: Json | null
          ai_summary?: string | null
          applied_at?: string | null
          applied_by?: string | null
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
          parent_job_id?: string | null
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
          {
            foreignKeyName: "import_jobs_parent_job_id_fkey"
            columns: ["parent_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
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
      promocao_saude_materiais: {
        Row: {
          acao_id: string
          criado_em: string
          descricao: string | null
          empresa_id: string
          id: string
          mime_type: string | null
          storage_bucket: string
          storage_path: string
          tamanho: number | null
          tipo: Database["public"]["Enums"]["tipo_material_saude"]
          titulo: string
          visivel_cliente: boolean
        }
        Insert: {
          acao_id: string
          criado_em?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          mime_type?: string | null
          storage_bucket?: string
          storage_path: string
          tamanho?: number | null
          tipo?: Database["public"]["Enums"]["tipo_material_saude"]
          titulo: string
          visivel_cliente?: boolean
        }
        Update: {
          acao_id?: string
          criado_em?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          mime_type?: string | null
          storage_bucket?: string
          storage_path?: string
          tamanho?: number | null
          tipo?: Database["public"]["Enums"]["tipo_material_saude"]
          titulo?: string
          visivel_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "promocao_saude_materiais_acao_id_fkey"
            columns: ["acao_id"]
            isOneToOne: false
            referencedRelation: "acoes_saude"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promocao_saude_materiais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      rd_station_sync_logs: {
        Row: {
          completed_at: string | null
          empresa_id: string
          error_message: string | null
          id: string
          request_id: string | null
          started_at: string
          status: string
          tasks_imported: number | null
          tasks_skipped: number | null
          tasks_updated: number | null
        }
        Insert: {
          completed_at?: string | null
          empresa_id: string
          error_message?: string | null
          id?: string
          request_id?: string | null
          started_at?: string
          status: string
          tasks_imported?: number | null
          tasks_skipped?: number | null
          tasks_updated?: number | null
        }
        Update: {
          completed_at?: string | null
          empresa_id?: string
          error_message?: string | null
          id?: string
          request_id?: string | null
          started_at?: string
          status?: string
          tasks_imported?: number | null
          tasks_skipped?: number | null
          tasks_updated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rd_station_sync_logs_empresa_id_fkey"
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
          fonte_pdf_path: string | null
          id: string
          import_job_id: string | null
          indice_sinistralidade: number | null
          media: number | null
          operadora: string | null
          produto: string | null
          quantidade_sinistros: number
          sinistros_consultas: number | null
          sinistros_exames: number | null
          sinistros_internacoes: number | null
          sinistros_outros: number | null
          sinistros_procedimentos: number | null
          updated_at: string
          valor_premio: number
          valor_sinistros: number
          vidas: number | null
          vidas_ativas: number | null
        }
        Insert: {
          categoria: Database["public"]["Enums"]["categoria_beneficio"]
          competencia: string
          created_at?: string
          criado_por: string
          empresa_id: string
          fonte_pdf_path?: string | null
          id?: string
          import_job_id?: string | null
          indice_sinistralidade?: number | null
          media?: number | null
          operadora?: string | null
          produto?: string | null
          quantidade_sinistros?: number
          sinistros_consultas?: number | null
          sinistros_exames?: number | null
          sinistros_internacoes?: number | null
          sinistros_outros?: number | null
          sinistros_procedimentos?: number | null
          updated_at?: string
          valor_premio?: number
          valor_sinistros?: number
          vidas?: number | null
          vidas_ativas?: number | null
        }
        Update: {
          categoria?: Database["public"]["Enums"]["categoria_beneficio"]
          competencia?: string
          created_at?: string
          criado_por?: string
          empresa_id?: string
          fonte_pdf_path?: string | null
          id?: string
          import_job_id?: string | null
          indice_sinistralidade?: number | null
          media?: number | null
          operadora?: string | null
          produto?: string | null
          quantidade_sinistros?: number
          sinistros_consultas?: number | null
          sinistros_exames?: number | null
          sinistros_internacoes?: number | null
          sinistros_outros?: number | null
          sinistros_procedimentos?: number | null
          updated_at?: string
          valor_premio?: number
          valor_sinistros?: number
          vidas?: number | null
          vidas_ativas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sinistralidade_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistralidade_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistralidade_documentos: {
        Row: {
          ai_summary: string | null
          competencias: string[] | null
          created_at: string
          empresa_id: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          import_job_id: string | null
          operadora: string
          periodo_fim: string | null
          periodo_inicio: string | null
          status: string
          tipo_relatorio: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          ai_summary?: string | null
          competencias?: string[] | null
          created_at?: string
          empresa_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          import_job_id?: string | null
          operadora?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          status?: string
          tipo_relatorio?: string | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          ai_summary?: string | null
          competencias?: string[] | null
          created_at?: string
          empresa_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          import_job_id?: string | null
          operadora?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          status?: string
          tipo_relatorio?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistralidade_documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistralidade_documentos_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistralidade_indicadores_periodo: {
        Row: {
          created_at: string
          criado_por: string
          empresa_id: string
          fonte_pdf_path: string | null
          id: string
          import_job_id: string | null
          media_periodo: number | null
          metricas: Json | null
          operadora: string | null
          periodo_fim: string
          periodo_inicio: string
          premio_medio_periodo: number | null
          produto: string | null
          quebras: Json | null
          sinistros_medio_periodo: number | null
          tipo_relatorio: string
          updated_at: string
          vidas_ativas_media_periodo: number | null
        }
        Insert: {
          created_at?: string
          criado_por: string
          empresa_id: string
          fonte_pdf_path?: string | null
          id?: string
          import_job_id?: string | null
          media_periodo?: number | null
          metricas?: Json | null
          operadora?: string | null
          periodo_fim: string
          periodo_inicio: string
          premio_medio_periodo?: number | null
          produto?: string | null
          quebras?: Json | null
          sinistros_medio_periodo?: number | null
          tipo_relatorio: string
          updated_at?: string
          vidas_ativas_media_periodo?: number | null
        }
        Update: {
          created_at?: string
          criado_por?: string
          empresa_id?: string
          fonte_pdf_path?: string | null
          id?: string
          import_job_id?: string | null
          media_periodo?: number | null
          metricas?: Json | null
          operadora?: string | null
          periodo_fim?: string
          periodo_inicio?: string
          premio_medio_periodo?: number | null
          produto?: string | null
          quebras?: Json | null
          sinistros_medio_periodo?: number | null
          tipo_relatorio?: string
          updated_at?: string
          vidas_ativas_media_periodo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sinistralidade_indicadores_periodo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistralidade_indicadores_periodo_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistro_documentos: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          nome_arquivo: string
          sinistro_id: string
          storage_path: string
          tamanho: number
          tipo_mime: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          nome_arquivo: string
          sinistro_id: string
          storage_path: string
          tamanho: number
          tipo_mime: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          nome_arquivo?: string
          sinistro_id?: string
          storage_path?: string
          tamanho?: number
          tipo_mime?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistro_documentos_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros_vida"
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
      user_preferences: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          preferences: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          preferences?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          preferences?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_empresa_id_fkey"
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
      faturamento_documento_tipo: "boleto" | "nf" | "demonstrativo" | "outro"
      faturamento_entidade_tipo: "coligada" | "subestipulante"
      faturamento_produto: "saude" | "vida" | "odonto"
      faturamento_status:
        | "aguardando_pagamento"
        | "pago"
        | "atraso"
        | "cancelado"
      grau_parentesco: "conjuge" | "filho" | "pai" | "mae" | "outro"
      import_data_type:
        | "beneficiarios"
        | "faturamento"
        | "sinistralidade"
        | "movimentacoes"
        | "contratos"
        | "sinistralidade_pdf"
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
      tipo_material_saude:
        | "whatsapp"
        | "folder"
        | "cartaz"
        | "brinde"
        | "email"
        | "outro"
      tipo_movimentacao:
        | "inclusao"
        | "exclusao"
        | "alteracao_cadastral"
        | "mudanca_plano"
      visibilidade_acao: "interna" | "cliente"
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
      faturamento_documento_tipo: ["boleto", "nf", "demonstrativo", "outro"],
      faturamento_entidade_tipo: ["coligada", "subestipulante"],
      faturamento_produto: ["saude", "vida", "odonto"],
      faturamento_status: [
        "aguardando_pagamento",
        "pago",
        "atraso",
        "cancelado",
      ],
      grau_parentesco: ["conjuge", "filho", "pai", "mae", "outro"],
      import_data_type: [
        "beneficiarios",
        "faturamento",
        "sinistralidade",
        "movimentacoes",
        "contratos",
        "sinistralidade_pdf",
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
      tipo_material_saude: [
        "whatsapp",
        "folder",
        "cartaz",
        "brinde",
        "email",
        "outro",
      ],
      tipo_movimentacao: [
        "inclusao",
        "exclusao",
        "alteracao_cadastral",
        "mudanca_plano",
      ],
      visibilidade_acao: ["interna", "cliente"],
    },
  },
} as const
