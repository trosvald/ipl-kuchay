-- M12: Public dashboard must remain aggregate-only.
-- Remove per-kavling status RPC exposure to protect payment privacy.

revoke execute on function public.get_public_kavling_status(uuid) from public;
revoke execute on function public.get_public_kavling_status(uuid) from anon;
revoke execute on function public.get_public_kavling_status(uuid) from authenticated;

drop function if exists public.get_public_kavling_status(uuid);
