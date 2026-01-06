# Checklist de Testes - Visão Empresa (Usuário Cliente)

## Objetivo
Validar que usuários com roles `rh_gestor` ou `visualizador` têm uma experiência de **somente leitura** com acesso a downloads, sem funções administrativas.

---

## Pré-requisitos
1. Ter um usuário de teste com role `rh_gestor` ou `visualizador`
2. Ter dados de teste na empresa associada ao usuário

---

## Testes por Módulo

### 1. Dashboard
| Teste | Esperado | ✓/✗ |
|-------|----------|-----|
| KPIs exibem dados corretos | Vidas Ativas, Índice Médio, etc. aparecem | |
| Gráficos carregam | Sinistralidade, Faturamento, Demandas | |
| Pendências visíveis | Faturas vencidas, contratos vencendo, demandas pendentes | |
| Botão "Marcar como pago" OCULTO | Só admin pode marcar fatura como paga | |
| Ações Rápidas OCULTAS | Card de ações rápidas não aparece para cliente | |
| Card "Recomendações IA" mostra "Em breve" | Placeholder amigável | |

### 2. Sinistralidade
| Teste | Esperado | ✓/✗ |
|-------|----------|-----|
| KPIs exibem Índice Médio do PDF | Fonte "Média do Relatório (Unimed BH)" | |
| Gráfico 12 meses carrega | Todos os meses visíveis, mesmo sem dados | |
| Tooltip mostra Prêmio, Sinistros, IU% | Informações completas | |
| Botão "Importar PDF" OCULTO | Só admin pode importar | |
| Seção "Indicadores por Período" visível | Somente leitura | |
| Download de documentos funciona | PDFs baixam corretamente | |

### 3. Faturamento
| Teste | Esperado | ✓/✗ |
|-------|----------|-----|
| Lista de faturas carrega | Todas as faturas da empresa | |
| Status "Em Atraso" automático | Faturas vencidas mostram corretamente | |
| Botão "Nova Fatura" OCULTO | Só admin pode criar | |
| Botões "Editar" e "Excluir" OCULTOS | Só admin pode editar/excluir | |
| Botão "Marcar como pago" OCULTO | Só admin pode marcar | |
| Botão "Ver detalhes" funciona | Modal abre com informações | |
| Download de boleto/NF funciona | Documentos baixam corretamente | |

### 4. Demandas
| Teste | Esperado | ✓/✗ |
|-------|----------|-----|
| Lista de demandas carrega | Demandas da empresa visíveis | |
| Timeline/histórico funciona | Prestação de contas visível | |
| SLA exibido para concluídas | Tempo de conclusão aparece | |
| Botões RD Station OCULTOS | Sincronizar, Configurar não aparecem | |
| Badge RD Station NÃO aparece | Clientes não veem status RD | |
| Botão "Ver detalhes" funciona | Modal com timeline abre | |

### 5. Contratos
| Teste | Esperado | ✓/✗ |
|-------|----------|-----|
| Lista de contratos carrega | Contratos da empresa | |
| Filtros funcionam | Produto, Tipo, Status, Filial | |
| Botão "Novo Contrato" OCULTO | Só admin pode criar | |
| Menu "Editar/Excluir" OCULTO | Só admin pode editar/excluir | |
| Botão "Ver detalhes" funciona | Modal abre com documentos | |
| Download de contrato funciona | Arquivos baixam corretamente | |

### 6. Promoção de Saúde
| Teste | Esperado | ✓/✗ |
|-------|----------|-----|
| Calendário carrega | Ações nos dias corretos | |
| Lista de ações carrega | Tabela com filtros | |
| Campanha do mês visível | Badge colorido aparece | |
| Botão "Nova Ação" OCULTO | Só admin pode criar | |
| Clicar no calendário NÃO abre modal | Clientes não criam ações | |
| Coluna "Visibilidade" OCULTA | Clientes não veem esta coluna | |
| Botões "Editar/Excluir" OCULTOS | Só admin pode editar/excluir | |
| Download de materiais funciona | PDFs/imagens baixam | |

### 7. Relatórios
| Teste | Esperado | ✓/✗ |
|-------|----------|-----|
| Página carrega sem erro | Interface de relatórios | |
| Filtros funcionam | Período, produto, status | |
| Exportação funciona | PDF/Excel geram | |

### 8. Configurações
| Teste | Esperado | ✓/✗ |
|-------|----------|-----|
| Visão simplificada (4 tabs) | Perfil, Empresa, Notificações, Segurança | |
| Perfil editável | Nome, telefone, cargo salvam | |
| Empresa somente leitura | Campos desabilitados | |
| Notificações persistem | Preferências salvam no banco | |
| Segurança mostra role | Badge com "Gestor de RH" ou similar | |
| Tabs administrativas OCULTAS | Geral, IA, Logs não aparecem | |

### 9. Sidebar
| Teste | Esperado | ✓/✗ |
|-------|----------|-----|
| Módulos principais visíveis | Dashboard, Faturamento, Sinistralidade, etc. | |
| Demandas visível | Clientes podem acessar demandas | |
| Beneficiários como "Em breve" | Badge "Em breve" aparece | |
| Movimentação de Vidas como "Em breve" | Badge "Em breve" aparece | |
| Central de Importação OCULTA | Só admin vê | |
| Central de Testes OCULTA | Só admin_vizio vê | |
| Configurações visível | Clientes acessam config simplificada | |

---

## Testes de Segurança

| Teste | Esperado | ✓/✗ |
|-------|----------|-----|
| Usuário só vê dados da própria empresa | Nenhum dado de outra empresa visível | |
| Tentar URL admin direta (ex: /admin/importacao) | Redireciona ou mostra "sem permissão" | |
| Selector de empresa OCULTO no header | Clientes não trocam empresa | |

---

## Notas de Implementação

### Permissões por Role
| Role | Acesso |
|------|--------|
| `admin_vizio` | CRUD completo, setup, importação, multi-empresa |
| `admin_empresa` | CRUD na própria empresa, sem setup global |
| `rh_gestor` | Visualização, downloads, criar demandas |
| `visualizador` | Apenas visualização e downloads |

### Alterações Realizadas
1. ✅ `usePermissions` atualizado com `canCreateDemandas` para `rh_gestor`
2. ✅ Sidebar atualizado - Demandas agora visível para clientes
3. ✅ Demandas - botões RD Station ocultos para clientes
4. ✅ Todas as páginas verificam permissões corretamente
5. ✅ Configurações tem visão diferenciada para clientes
6. ✅ ComingSoon funciona para módulos não liberados

---

## Resultado Final
- [ ] Todos os testes passaram
- [ ] Nenhuma ação administrativa visível para cliente
- [ ] Downloads funcionam corretamente
- [ ] Dados isolados por empresa
