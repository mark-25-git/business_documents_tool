-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  email TEXT,
  billing_address TEXT,
  billing_phone TEXT,
  billing_email TEXT,
  shipping_name TEXT,
  shipping_address TEXT,
  shipping_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  doc_number TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL, -- INVOICE, QUOTATION, RECEIPT, DELIVERY_ORDER, PROFORMA_INVOICE
  date DATE NOT NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL,
  notes TEXT,
  billing_address TEXT,
  billing_phone TEXT,
  billing_email TEXT,
  shipping_name TEXT,
  shipping_address TEXT,
  shipping_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create line_items table
CREATE TABLE IF NOT EXISTS line_items (
  id TEXT PRIMARY KEY,
  doc_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00
);

-- Enable Row Level Security (RLS)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;

-- Create policies for customers
CREATE POLICY "Allow public read customers" ON customers FOR SELECT USING (true);
CREATE POLICY "Allow public insert customers" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update customers" ON customers FOR UPDATE USING (true);
CREATE POLICY "Allow public delete customers" ON customers FOR DELETE USING (true);

-- Create policies for documents
CREATE POLICY "Allow public read documents" ON documents FOR SELECT USING (true);
CREATE POLICY "Allow public insert documents" ON documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update documents" ON documents FOR UPDATE USING (true);
CREATE POLICY "Allow public delete documents" ON documents FOR DELETE USING (true);

-- Create policies for line_items
CREATE POLICY "Allow public read line_items" ON line_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert line_items" ON line_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update line_items" ON line_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete line_items" ON line_items FOR DELETE USING (true);
