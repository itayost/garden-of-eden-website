-- Close the benchmark recompute to API callers.
--
-- recalculate_age_group_benchmarks() is SECURITY DEFINER and was executable by
-- PUBLIC, so anyone with the anon key could loop POST /rpc/... and make every
-- call rescan all assessments. It leaks nothing, but it is free load. Its
-- callers keep working: the triggers run it from SECURITY DEFINER functions as
-- the owner, and the nightly cron uses the service role.
--
-- The two age-group helpers get a fixed search_path, as Supabase's
-- function_search_path_mutable lint asks.

REVOKE EXECUTE ON FUNCTION public.recalculate_age_group_benchmarks(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_age_group_benchmarks(text) TO service_role;

ALTER FUNCTION public.compute_age_group(date) SET search_path = public;
ALTER FUNCTION public.effective_age_group(date, text, date) SET search_path = public;
