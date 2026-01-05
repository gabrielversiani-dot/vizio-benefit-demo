# Roteiro de Testes - Módulo de Contratos

## Data: 2026-01-05
## Status: ✅ Preparado para Teste

---

## 1. Massa de Teste Criada

### Empresa de Teste
- **Empresa**: Vilma Alimentos
- **ID**: `6e8a5f31-7177-4caf-a2a3-2704e7a506c2`

### Filiais Existentes
| Nome | Tipo | ID |
|------|------|-----|
| Matriz | coligada | `728fff83-10aa-4f09-8055-4033d74e31cf` |
| Krokero | coligada | `c6589ccc-d8f3-451f-ac51-df90321a1a78` |
| Unidade Contagem | subestipulante | `c2869801-0e8d-4cda-9128-a9b9e3376509` |

### Contratos Criados para Teste
| Título | Produto | Tipo | Status | Filial | Vigência |
|--------|---------|------|--------|--------|----------|
| Contrato Unimed BH 2025 | Saúde | Contrato | Ativo | Matriz | 01/01/2025 - 31/12/2025 |
| Aditivo Odontoprev Krokero | Odonto | Aditivo | Ativo | Krokero | 01/02/2025 - 31/08/2025 |
| Reajuste Seguro Vida 2025 | Vida | Reajuste | Ativo | - | 01/01/2025 - 01/01/2026 |
| Contrato Odontoprev Corporativo | Odonto | Contrato | Em Renovação | - | 01/06/2024 - 30/06/2025 |
| Seguro Vida Antigo | Vida | Contrato | Vencido | Matriz | 01/01/2023 - 31/12/2024 |
| Contrato Unimed BH (existente) | Saúde | Aditivo | Ativo | Matriz | 01/03/2022 - 01/03/2023 |

---

## 2. Roteiro de Testes

### 2.1 Listagem e Filtros ✅

#### Checklist
- [ ] A tabela exibe todos os contratos da empresa selecionada
- [ ] Colunas visíveis: Título, Filial, Produto, Tipo, Vigência, Status, Docs, Ações
- [ ] Badges de Produto (Saúde=rosa, Odonto=ciano, Vida=roxo)
- [ ] Badges de Tipo (Contrato, Aditivo, Reajuste)
- [ ] Status com ícones corretos

#### Filtros a testar
- [ ] Filtrar por **Produto = Saúde** → deve mostrar apenas 2 contratos
- [ ] Filtrar por **Tipo = Aditivo** → deve mostrar 2 contratos  
- [ ] Filtrar por **Status = Vencido** → deve mostrar 1 contrato
- [ ] Filtrar por **Filial = Matriz** → deve mostrar 3 contratos
- [ ] Filtrar por **Filial = Krokero** → deve mostrar 1 contrato
- [ ] Buscar por texto "Unimed" → deve mostrar 2 contratos
- [ ] Combinar filtros: Produto=Odonto + Status=Ativo → 1 contrato

### 2.2 Criar Novo Contrato ✅

#### Step 1 - Dados
- [ ] Selecionar produto: Saúde
- [ ] Selecionar tipo: Contrato
- [ ] Preencher título: "Contrato Teste UI"
- [ ] Preencher vigência início e fim
- [ ] Selecionar filial (opcional): Krokero
- [ ] Clicar "Próximo"

#### Step 2 - Documentos
- [ ] Fazer upload de um PDF
- [ ] Verificar que arquivo aparece na lista
- [ ] Clicar "Salvar"
- [ ] Verificar toast de sucesso
- [ ] Verificar que contrato aparece na listagem

#### Validação especial: Tipo Reajuste
- [ ] Criar contrato tipo "Reajuste"
- [ ] Verificar que campos "Competência de Referência" e "% Reajuste" aparecem
- [ ] Validar que % reajuste é obrigatório para reajuste

### 2.3 Detalhe do Contrato ✅

- [ ] Clicar em um contrato para abrir detalhes
- [ ] Verificar metadados: Produto, Tipo, Vigência, Operadora, Número
- [ ] Verificar seção Documentos lista os arquivos
- [ ] Verificar versão de cada documento

### 2.4 Upload de Documentos ✅

- [ ] Abrir detalhe de um contrato existente
- [ ] Clicar "Adicionar Documento"
- [ ] Fazer upload de novo arquivo
- [ ] Verificar que aparece na lista sem F5
- [ ] Verificar contagem de docs atualiza na listagem

### 2.5 Download de Documentos ✅

- [ ] Abrir detalhe de contrato com documentos
- [ ] Clicar no botão download de um documento
- [ ] Verificar que download inicia
- [ ] Verificar nome do arquivo correto

### 2.6 Editar Contrato ✅

- [ ] Clicar em Editar (ícone lápis) em um contrato
- [ ] Alterar status para "Suspenso"
- [ ] Alterar observações
- [ ] Salvar
- [ ] Verificar que mudanças refletem na listagem

### 2.7 Excluir Contrato ✅

- [ ] Clicar em Excluir (ícone lixeira) em um contrato
- [ ] Confirmar exclusão no dialog
- [ ] Verificar que contrato desaparece da listagem
- [ ] Verificar que documentos foram removidos do storage

### 2.8 Excluir Documento ✅

- [ ] Abrir detalhe de contrato com múltiplos documentos
- [ ] Clicar para excluir um documento
- [ ] Confirmar exclusão
- [ ] Verificar que documento some da lista

---

## 3. Testes de Segurança/RLS

### 3.1 Isolamento por Empresa
- [ ] Usuário de Vilma Alimentos vê apenas contratos da Vilma
- [ ] Usuário de Capital Vizio (admin) vê todos

### 3.2 Permissões por Role

| Ação | admin_vizio | admin_empresa | rh_gestor | visualizador |
|------|-------------|---------------|-----------|--------------|
| Ver contratos | ✅ | ✅ | ✅ | ✅ |
| Criar contrato | ✅ | ✅ | ✅ | ❌ |
| Editar contrato | ✅ | ✅ | ✅ | ❌ |
| Excluir contrato | ✅ | ✅ | ❌ | ❌ |
| Upload documento | ✅ | ✅ | ✅ | ❌ |
| Download documento | ✅ | ✅ | ✅ | ✅ |
| Excluir documento | ✅ | ✅ | ❌ | ❌ |

---

## 4. Checklist de Policies Aplicadas

### Tabela `contratos`
- [x] Admin Vizio: ALL operations
- [x] Admin Empresa: SELECT, INSERT, UPDATE, DELETE (própria empresa)
- [x] RH Gestor: SELECT, INSERT, UPDATE (própria empresa)
- [x] Visualizador: SELECT (própria empresa)

### Tabela `contrato_documentos`
- [x] Admin Vizio: ALL operations
- [x] Admin Empresa: ALL (própria empresa)
- [x] RH Gestor: SELECT, INSERT (própria empresa)
- [x] Visualizador: SELECT (própria empresa)

### Storage Bucket `contratos`
- [x] SELECT: todos da mesma empresa
- [x] INSERT: admin_vizio, admin_empresa, rh_gestor (própria empresa)
- [x] UPDATE/DELETE: admin_vizio, admin_empresa (própria empresa)

---

## 5. Bugs Encontrados e Corrigidos

| # | Descrição | Status | Correção |
|---|-----------|--------|----------|
| 1 | Campo `produto` usava `vida_em_grupo` no front mas banco aceitava `vida` | ✅ Corrigido | Alinhado front para usar `vida` |
| 2 | RLS de `contratos` faltava INSERT/UPDATE/DELETE para `admin_empresa` e `rh_gestor` | ✅ Corrigido | Migration aplicada |
| 3 | RLS de `contrato_documentos` policy INSERT para `rh_gestor` sem WITH CHECK | ✅ Corrigido | Policy recriada |
| 4 | Select de Filial com value="" quebrava Radix | ✅ Corrigido | Usando `_none` como placeholder |

---

## 6. Melhorias Futuras (Backlog)

- [ ] Alerta de renovação 60/30/7 dias antes do vencimento
- [ ] Controle de versões: marcar documento "ativo" e manter histórico
- [ ] Audit log: registrar upload/download/exclusão
- [ ] Validação de duplicidade de contrato por número
- [ ] Preview de PDF inline no modal de detalhes

---

## 7. Consultas SQL para Validação

### Ver todos contratos
```sql
SELECT c.*, fe.nome as filial_nome 
FROM contratos c 
LEFT JOIN faturamento_entidades fe ON fe.id = c.filial_id 
WHERE c.empresa_id = '6e8a5f31-7177-4caf-a2a3-2704e7a506c2'
ORDER BY c.created_at DESC;
```

### Ver documentos de um contrato
```sql
SELECT * FROM contrato_documentos 
WHERE contrato_id = '[ID_DO_CONTRATO]'
ORDER BY versao DESC, created_at DESC;
```

### Verificar RLS policies
```sql
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'contratos' AND schemaname = 'public';
```

---

## 8. Conclusão

O módulo de Contratos está **pronto para testes de aceitação**. A massa de dados foi criada, as policies de segurança foram aplicadas e os bugs identificados durante a implementação foram corrigidos.

**Próximos passos:**
1. Executar o roteiro de testes manualmente
2. Validar com usuário final
3. Documentar resultados
