ALTER TABLE public.practices
ADD COLUMN IF NOT EXISTS original_image_key text;

UPDATE public.practices
SET original_image_key = image_key
WHERE original_image_key IS NULL
  AND image_key IN (
    'short-refuge', 'prostrations', 'diamond-mind', 'mandala', 'guru-yoga',
    'amitabha', 'generic', '16th-karmapa', 'chenrezig', 'green-tara',
    'white-tara', 'loving-eyes', 'white-liberatrice'
  );

CREATE OR REPLACE FUNCTION public.preserve_practice_original_image_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.original_image_key := COALESCE(
      OLD.original_image_key,
      NEW.original_image_key
    );
  END IF;

  IF NEW.original_image_key IS NULL AND NEW.image_key IN (
    'short-refuge', 'prostrations', 'diamond-mind', 'mandala', 'guru-yoga',
    'amitabha', 'generic', '16th-karmapa', 'chenrezig', 'green-tara',
    'white-tara', 'loving-eyes', 'white-liberatrice'
  ) THEN
    NEW.original_image_key := NEW.image_key;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS preserve_practice_original_image_key ON public.practices;
CREATE TRIGGER preserve_practice_original_image_key
BEFORE INSERT OR UPDATE ON public.practices
FOR EACH ROW EXECUTE FUNCTION public.preserve_practice_original_image_key();
