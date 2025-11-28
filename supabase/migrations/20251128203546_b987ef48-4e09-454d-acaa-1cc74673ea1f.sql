-- Atribuir role admin_vizio ao usuário atual
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin_vizio'::app_role
FROM public.profiles
WHERE email = 'gabriel.versiani@capitalvizio.com.br'
ON CONFLICT (user_id, role) DO NOTHING;