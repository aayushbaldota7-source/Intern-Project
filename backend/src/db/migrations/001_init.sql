-- ============================================================
-- Migration: 001_init.sql
-- Creates the orders table and a LISTEN/NOTIFY trigger
-- that fires on INSERT, UPDATE, and DELETE.
-- ============================================================

-- ── Orders Table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id            SERIAL PRIMARY KEY,
    customer_name VARCHAR(255)  NOT NULL,
    product_name  VARCHAR(255)  NOT NULL,
    status        VARCHAR(50)   NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'shipped', 'delivered')),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Trigger Function ────────────────────────────────────────
-- Fires on every INSERT / UPDATE / DELETE and sends a
-- JSON payload on the 'orders_channel' notification channel.
CREATE OR REPLACE FUNCTION notify_orders_change()
RETURNS TRIGGER AS $$
DECLARE
    payload  JSON;
    record   RECORD;
BEGIN
    -- For DELETE events the row is in OLD, otherwise in NEW
    IF TG_OP = 'DELETE' THEN
        record := OLD;
    ELSE
        record := NEW;
    END IF;

    payload := json_build_object(
        'operation', TG_OP,         -- 'INSERT' | 'UPDATE' | 'DELETE'
        'table',     TG_TABLE_NAME, -- 'orders'
        'data',      row_to_json(record)
    );

    -- Publish to the channel (max 8000 bytes per NOTIFY)
    PERFORM pg_notify('orders_channel', payload::text);

    -- Return the appropriate record so the DML still succeeds
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ── Attach Trigger ──────────────────────────────────────────
-- Drop first so this file is idempotent (re-runnable)
DROP TRIGGER IF EXISTS orders_change_trigger ON orders;

CREATE TRIGGER orders_change_trigger
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION notify_orders_change();

-- ── Seed Data (optional) ─────────────────────────────────────
INSERT INTO orders (customer_name, product_name, status) VALUES
    ('Rohit', 'Wireless Headphones', 'pending')
ON CONFLICT DO NOTHING;
