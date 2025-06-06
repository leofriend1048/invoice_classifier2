**Product Requirements Document (PRD): AI-Powered Invoice Classification System**

---

### 1. Overview

An AI-powered invoice classification system using **GPT-4o OCR**, **Supabase** for data management, and a **Next.js + ShadCN + Tailwind** front-end for human-in-the-loop verification. The system automates extraction, classification, review, and payment workflow of invoices.

---

### 2. Functional Requirements

#### 2.1 Email Ingestion & Attachment Parsing

- Process forwarded invoice emails via Gmail webhook.
- Extract attachments (PDF or image format).
- Identify invoice files based on filename/content heuristics.

#### 2.2 OCR & Data Extraction (GPT-4o)

- Use GPT-4o Vision to extract:

  - `vendor_name`
  - `invoice_date`
  - `due_date`
  - `amount`
  - `extracted_text`

- Email body is also parsed for additional context like notes, project codes, or categorization hints.

#### 2.3 Invoice Storage (Supabase)

- Store invoice metadata, extracted content, classification suggestions, status, and PDF URL.
- Track changes and approvals with timestamps and audit trail.

#### 2.4 Classification Engine

- Pattern-based classification using historical invoice patterns.
- GPT-4o classification with fallback logic.
- Hybrid logic to combine best-match pattern with GPT results.

#### 2.5 Pattern Learning

- Auto-generate classification patterns upon approval:

  - `vendor_regex`
  - `amount_range`
  - `text_contains`

- Continuously evolve based on user corrections and match performance.

#### 2.6 Vendor Profile Intelligence

- Maintain a profile of each vendor:

  - Typical category
  - Average invoice amount
  - Recurrence behavior
  - Auto-approval confidence threshold

#### 2.7 Human-in-the-Loop Review UI

- Web dashboard to:

  - View new/pending invoices received from the mtbinvoice@gmail.com gmail account
  - See AI suggestions + confidence scores
  - Edit classification (category, subcategory, description)
  - Approve with status: `paid` or `needs_payment`

#### 2.8 Payment Integration

- If `needs_payment`, email invoice to `ap@michaeltoddbeauty.com` with:

  - Invoice PDF attached
  - Metadata summary (vendor, amount, due date)
  - Categorization

- Update payment status post email delivery.

#### 2.9 Real-Time Updates

- Supabase real-time channel (`invoice-updates`) triggers front-end updates on insert/update.

---

### 3. Non-Functional Requirements

- **Accuracy:** ≥95% with hybrid classification after 3 rounds of feedback.
- **Latency:** OCR + classification in < 3 seconds per invoice.
- **Scalability:** 100+ invoices/day.
- **Uptime:** 99.9% with basic error recovery + retry queues.

---

### 4. UI & UX Structure

#### 4.1 Dashboard Tabs

- All
- Pending
- Low Confidence (< 0.8)
- Paid

#### 4.2 Invoice Cards

- Vendor name, date, amount
- Confidence badge: Low / Medium / High
- Category/subcategory preview
- PDF preview and extracted text toggle

#### 4.3 Quick Actions

- Approve + Needs Payment
- Approve + Already Paid
- Edit category/subcategory

#### 4.4 Mobile UX Optimizations

- Sticky bottom action bar for review/edit
- Swipe to approve or reject

#### 4.5 Keyboard Shortcuts

- Enter = Approve
- P = Mark as Paid
- R = Reject or Request Changes

---

### 5. Architecture Overview

#### Tech Stack

- **Frontend:** Next.js 15 App Router + Tailwind + ShadCN
- **Database:** Supabase PostgreSQL
- **OCR & AI:** GPT-4o (OCR + Classification)
- **Email Parsing:** Gmail API + OAuth + webhook
- **Storage:** Supabase Bucket for PDFs
- **Notifications:** Use our mtbinvoice@gmail.com gmail account for sending to AP
- **Realtime:** Supabase Channels
- **State Management:** Zustand

---

### 6. Workflow

1. Email is forwarded to system.
2. Gmail webhook triggers parsing.
3. PDF/image is passed to GPT-4o for text extraction.
4. Invoice is inserted into Supabase.
5. Classification engine runs:

   - Pattern match
   - GPT-4o AI analysis
   - Hybrid merge logic

6. Human reviews classification in dashboard.
7. If approved:

   - Status set to `approved`
   - If `needs_payment`: email sent to AP
   - If `paid`: marked and closed

8. System learns new patterns from approval.
9. Pattern match accuracy is updated.

---

### 7. Features to include

- Bulk actions: classify multiple invoices together
- Priority inbox sorting by amount, confidence, or due date

---

### 8. Success Metrics

- Manual intervention < 20% after month 1
- Average classification confidence > 0.9
- Invoice review time < 30 seconds per invoice
- Payment request latency < 10 minutes after approval
- Pattern match success rate increasing week-over-week

---

### 9. Security & Access

- Supabase Auth DO NOT IMPLEMENT THIS
- DON'T USE RLS AT ALL ON THIS PROJECT

---

**Note:** All Supabase tables must be prefixed with `invoice_class_`.
