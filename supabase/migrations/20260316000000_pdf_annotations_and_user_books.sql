-- user_books: stores PDF documents uploaded or linked by users
CREATE TABLE IF NOT EXISTS user_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'מסמך ללא שם',
  file_name TEXT,
  file_url TEXT NOT NULL,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_books ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (public access, same as other tables in this project)
CREATE POLICY "user_books_select" ON user_books FOR SELECT USING (true);
CREATE POLICY "user_books_insert" ON user_books FOR INSERT WITH CHECK (true);
CREATE POLICY "user_books_update" ON user_books FOR UPDATE USING (true);
CREATE POLICY "user_books_delete" ON user_books FOR DELETE USING (true);

-- pdf_annotations: annotations, bookmarks, and highlights on PDF pages
CREATE TABLE IF NOT EXISTS pdf_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES user_books(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  note_text TEXT NOT NULL,
  highlight_text TEXT,
  highlight_rects JSONB,
  position_x NUMERIC,
  position_y NUMERIC,
  color TEXT DEFAULT '#FFEB3B',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pdf_annotations_book_page ON pdf_annotations(book_id, page_number);

ALTER TABLE pdf_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pdf_annotations_select" ON pdf_annotations FOR SELECT USING (true);
CREATE POLICY "pdf_annotations_insert" ON pdf_annotations FOR INSERT WITH CHECK (true);
CREATE POLICY "pdf_annotations_update" ON pdf_annotations FOR UPDATE USING (true);
CREATE POLICY "pdf_annotations_delete" ON pdf_annotations FOR DELETE USING (true);
