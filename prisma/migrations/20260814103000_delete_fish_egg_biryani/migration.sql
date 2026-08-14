UPDATE order_items SET "menuItemId" = NULL
WHERE "menuItemId" IN (
  SELECT id FROM menu_items WHERE name IN ('Fish Biryani', 'Egg Biryani')
);

DELETE FROM menu_items WHERE name IN ('Fish Biryani', 'Egg Biryani');
