-- =========================================================================
-- MERI LOCAL BAZAAR (BAZAARX) - COMPLETE UPI UTR & STATUS CONSTRAINT FIX
-- Copy and run this entire script in Supabase Dashboard -> SQL Editor
-- =========================================================================

-- 1. Ensure transaction_id column exists as VARCHAR(12) on public.orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(12);

DO $$ 
BEGIN 
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'orders' 
      AND column_name = 'transaction_id' 
      AND data_type <> 'character varying'
  ) THEN 
    ALTER TABLE public.orders ALTER COLUMN transaction_id TYPE VARCHAR(12);
  END IF;
END $$;

-- 2. Update orders table constraints to permit 'pending_verification'
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_order_status_check;

ALTER TABLE public.orders 
ADD CONSTRAINT orders_order_status_check CHECK (order_status IN (
  'pending', 'pending_verification', 'confirmed', 'processing', 'packed', 'ready_for_pickup',
  'assigned_to_delivery_partner', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled', 'returned'
));

-- 3. Ensure defaults on public.orders
ALTER TABLE public.orders 
ALTER COLUMN order_status SET DEFAULT 'pending_verification';

ALTER TABLE public.orders 
ALTER COLUMN payment_status SET DEFAULT 'pending';

-- 4. Check constraint on transaction_id: exactly 12 numeric digits (0-9)
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS chk_orders_transaction_id_12_digits;

ALTER TABLE public.orders 
ADD CONSTRAINT chk_orders_transaction_id_12_digits 
CHECK (transaction_id IS NULL OR transaction_id ~ '^[0-9]{12}$');

-- 5. Repeat on public.seller_orders
ALTER TABLE public.seller_orders 
ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(12);

DO $$ 
BEGIN 
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'seller_orders' 
      AND column_name = 'transaction_id' 
      AND data_type <> 'character varying'
  ) THEN 
    ALTER TABLE public.seller_orders ALTER COLUMN transaction_id TYPE VARCHAR(12);
  END IF;
END $$;

ALTER TABLE public.seller_orders 
DROP CONSTRAINT IF EXISTS seller_orders_status_check;

ALTER TABLE public.seller_orders 
ADD CONSTRAINT seller_orders_status_check CHECK (status IN (
  'pending', 'pending_verification', 'confirmed', 'processing', 'packed', 'ready_for_pickup',
  'assigned_to_delivery_partner', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled', 'returned'
));

ALTER TABLE public.seller_orders 
ALTER COLUMN status SET DEFAULT 'pending_verification';

ALTER TABLE public.seller_orders 
DROP CONSTRAINT IF EXISTS chk_seller_orders_transaction_id_12_digits;

ALTER TABLE public.seller_orders 
ADD CONSTRAINT chk_seller_orders_transaction_id_12_digits 
CHECK (transaction_id IS NULL OR transaction_id ~ '^[0-9]{12}$');

-- 6. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_orders_transaction_id 
ON public.orders (transaction_id);

CREATE INDEX IF NOT EXISTS idx_seller_orders_transaction_id 
ON public.seller_orders (transaction_id);

-- 7. Comments
COMMENT ON COLUMN public.orders.transaction_id IS 'Strict 12-digit UPI Transaction / UTR number entered by customer at checkout';
COMMENT ON COLUMN public.orders.order_status IS 'Order fulfillment status. Default: pending_verification';
COMMENT ON COLUMN public.orders.payment_status IS 'Payment status. Default: pending';
