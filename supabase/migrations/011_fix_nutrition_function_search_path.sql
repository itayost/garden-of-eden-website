-- Fix mutable search_path security warning
ALTER FUNCTION update_nutrition_updated_at() SET search_path = '';
