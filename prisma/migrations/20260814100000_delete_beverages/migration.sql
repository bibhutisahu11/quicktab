-- Detach from order history first, then delete
UPDATE order_items SET "menuItemId" = NULL
WHERE "menuItemId" IN (
  SELECT id FROM menu_items WHERE name IN ('Mango Lassi', 'Masala Chai', 'Cold Coffee')
);

DELETE FROM menu_items WHERE name IN ('Mango Lassi', 'Masala Chai', 'Cold Coffee');
