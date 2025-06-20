-- Drop the existing view first
DROP VIEW IF EXISTS failed_classifications_view;

-- Create a view for monitoring failed classifications with detailed field status
CREATE VIEW failed_classifications_view AS
SELECT 
    id,
    vendor_name,
    amount,
    invoice_date,
    created_at,
    updated_at,
    pdf_url,
    status,
    extracted_text,
    ARRAY_REMOVE(ARRAY[
        CASE WHEN vendor_name IS NULL THEN 'vendor_name' END,
        CASE WHEN amount IS NULL THEN 'amount' END,
        CASE WHEN extracted_text IS NULL THEN 'extracted_text' END,
        CASE WHEN classification_suggestion IS NULL THEN 'classification_suggestion' END,
        CASE WHEN (classification_suggestion->>'category') IS NULL THEN 'category' END,
        CASE WHEN (classification_suggestion->>'subcategory') IS NULL THEN 'subcategory' END
    ], NULL) as missing_fields,
    CASE 
        WHEN vendor_name IS NULL OR amount IS NULL OR extracted_text IS NULL THEN 'missing_required_fields'
        WHEN classification_suggestion IS NULL THEN 'missing_classification'
        WHEN (classification_suggestion->>'category') IS NULL THEN 'missing_category'
        WHEN (classification_suggestion->>'subcategory') IS NULL THEN 'missing_subcategory'
        WHEN (classification_suggestion->>'confidence')::float < 0.5 THEN 'low_confidence'
        ELSE NULL
    END as failure_reason
FROM 
    invoice_class_invoices
WHERE 
    vendor_name IS NULL OR
    amount IS NULL OR
    extracted_text IS NULL OR
    classification_suggestion IS NULL OR
    (classification_suggestion->>'category') IS NULL OR
    (classification_suggestion->>'subcategory') IS NULL OR
    (classification_suggestion->>'confidence')::float < 0.5
ORDER BY 
    created_at DESC;

-- Drop existing index if it exists
DROP INDEX IF EXISTS idx_invoice_class_classification_status;

-- Create an index to improve view performance
CREATE INDEX idx_invoice_class_classification_status 
ON invoice_class_invoices ((classification_suggestion IS NULL));

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_failed_classification_stats();

-- Create a function to get failed classification stats with field-level details
CREATE FUNCTION get_failed_classification_stats()
RETURNS TABLE (
    failure_type text,
    missing_fields text[],
    count bigint,
    percentage numeric
) AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT 
            CASE 
                WHEN vendor_name IS NULL OR amount IS NULL OR extracted_text IS NULL THEN 'missing_required_fields'
                WHEN classification_suggestion IS NULL THEN 'missing_classification'
                WHEN (classification_suggestion->>'category') IS NULL THEN 'missing_category'
                WHEN (classification_suggestion->>'subcategory') IS NULL THEN 'missing_subcategory'
                WHEN (classification_suggestion->>'confidence')::float < 0.5 THEN 'low_confidence'
                ELSE 'success'
            END as status,
            ARRAY_REMOVE(ARRAY[
                CASE WHEN vendor_name IS NULL THEN 'vendor_name' END,
                CASE WHEN amount IS NULL THEN 'amount' END,
                CASE WHEN extracted_text IS NULL THEN 'extracted_text' END,
                CASE WHEN classification_suggestion IS NULL THEN 'classification_suggestion' END,
                CASE WHEN (classification_suggestion->>'category') IS NULL THEN 'category' END,
                CASE WHEN (classification_suggestion->>'subcategory') IS NULL THEN 'subcategory' END
            ], NULL) as missing_fields,
            COUNT(*) as cnt
        FROM 
            invoice_class_invoices
        GROUP BY 1, 2
    ),
    total AS (
        SELECT SUM(cnt) as total_count FROM stats
    )
    SELECT 
        stats.status,
        stats.missing_fields,
        stats.cnt,
        ROUND((stats.cnt::numeric / total.total_count * 100)::numeric, 2) as percentage
    FROM 
        stats, total
    WHERE 
        stats.status != 'success'
    ORDER BY 
        stats.cnt DESC;
END;
$$ LANGUAGE plpgsql; 