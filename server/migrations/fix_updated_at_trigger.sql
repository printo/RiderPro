-- Fix the update_updated_at_column function to handle camelCase columns
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle camelCase columns (with quotes) vs snake_case columns
    IF TG_TABLE_NAME = 'shipments' OR TG_TABLE_NAME = 'acknowledgments' THEN
        NEW."updatedAt" = NOW();
    ELSE
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

