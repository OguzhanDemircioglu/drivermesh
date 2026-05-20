-- Advisor 0011_function_search_path_mutable: cloudinary_public_id_from_url
-- sadece regexp_match (pg_catalog) kullaniyor; kullanici search_path
-- override ile abuse edemez diye sabitleniyor.
ALTER FUNCTION public.cloudinary_public_id_from_url(text)
  SET search_path = '';;
