-- =========================================================================
-- MERI LOCAL BAZAAR (BAZAARX) - UPI 12-DIGIT UTR & STATUS MIGRATION
-- Copy and run this entire script in Supabase Dashboard -> SQL Editor
-- =========================================================================

-- 1. Ensure transaction_id column exists as VARCHAR(12) on public.orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(12);

-- If transaction_id already existed with another type, safely cast it to VARCHAR(12)
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

-- 2. Ensure payment_status column exists with DEFAULT 'pending'
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

ALTER TABLE public.orders 
ALTER COLUMN payment_status SET DEFAULT 'pending';

-- 3. Ensure order_status column exists with DEFAULT 'pending_verification'
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_status TEXT DEFAULT 'pending_verification';

ALTER TABLE public.orders 
ALTER COLUMN order_status SET DEFAULT 'pending_verification';

-- 4. Database-level Check Constraint: Exactly 12 numeric digits (0-9)
-- Allows NULL for Cash on Delivery (COD) orders, but if entered, enforces exactly 12 digits
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS chk_orders_transaction_id_12_digits;

ALTER TABLE public.orders 
ADD CONSTRAINT chk_orders_transaction_id_12_digits 
CHECK (transaction_id IS NULL OR transaction_id ~ '^[0-9]{12}$');

-- 5. Repeat for seller_orders table (Vendor fulfillment view)
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
DROP CONSTRAINT IF EXISTS chk_seller_orders_transaction_id_12_digits;

ALTER TABLE public.seller_orders 
ADD CONSTRAINT chk_seller_orders_transaction_id_12_digits 
CHECK (transaction_id IS NULL OR transaction_id ~ '^[0-9]{12}$');

-- 6. Performance Index for instant order lookup by UTR
CREATE INDEX IF NOT EXISTS idx_orders_transaction_id 
ON public.orders (transaction_id);

CREATE INDEX IF NOT EXISTS idx_seller_orders_transaction_id 
ON public.seller_orders (transaction_id);

-- 7. Add documentation comments
COMMENT ON COLUMN public.orders.transaction_id IS 'Strict 12-digit UPI Transaction / UTR number entered by customer at checkout';
COMMENT ON COLUMN public.orders.order_status IS 'Order fulfillment status. Default: pending_verification for review';
COMMENT ON COLUMN public.orders.payment_status IS 'Payment status. Default: pending';
