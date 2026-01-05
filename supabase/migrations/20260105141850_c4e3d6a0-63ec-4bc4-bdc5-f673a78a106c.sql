-- Add is_demo column to empresas table
ALTER TABLE public.empresas 
ADD COLUMN is_demo boolean NOT NULL DEFAULT false;