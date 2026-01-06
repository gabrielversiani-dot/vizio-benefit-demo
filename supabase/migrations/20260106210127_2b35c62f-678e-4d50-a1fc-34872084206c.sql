-- Ensure unique index for rd_deal_id per empresa (idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS sinistros_vida_empresa_rd_deal_unique 
ON public.sinistros_vida (empresa_id, rd_deal_id) 
WHERE rd_deal_id IS NOT NULL;

-- Ensure unique index for event_hash in timeline (idempotency)  
CREATE UNIQUE INDEX IF NOT EXISTS sinistros_vida_timeline_event_hash_unique
ON public.sinistros_vida_timeline (empresa_id, event_hash)
WHERE event_hash IS NOT NULL;