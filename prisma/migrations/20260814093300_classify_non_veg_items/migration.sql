-- Auto-classify non-veg items based on name keywords
UPDATE menu_items
SET "isVeg" = false
WHERE
  LOWER(name) LIKE '%chicken%' OR
  LOWER(name) LIKE '%mutton%'  OR
  LOWER(name) LIKE '%fish%'    OR
  LOWER(name) LIKE '%prawn%'   OR
  LOWER(name) LIKE '%crab%'    OR
  LOWER(name) LIKE '%seafood%' OR
  LOWER(name) LIKE '%keema%'   OR
  LOWER(name) LIKE '%kheema%'  OR
  LOWER(name) LIKE '%gosht%'   OR
  LOWER(name) LIKE '%shrimp%'  OR
  LOWER(name) LIKE '%lamb%'    OR
  LOWER(name) LIKE '%beef%'    OR
  LOWER(name) LIKE '%pork%'    OR
  LOWER(name) LIKE '%egg%';
