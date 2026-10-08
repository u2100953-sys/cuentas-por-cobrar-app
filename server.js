import express from 'express';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbFile = path.join(dataDir, 'receivables.db');
const db = new Database(dbFile);

const schema = `
  CREATE TABLE IF NOT EXISTS receivables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    document_number TEXT NOT NULL,
    amount REAL NOT NULL,
    invoice_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pendiente',
    radicado_number TEXT DEFAULT NULL,
    review_notes TEXT DEFAULT '',
    treasury_notes TEXT DEFAULT '',
    receipt_number TEXT DEFAULT NULL,
    receipt_date TEXT DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

db.exec(schema);

const count = db.prepare('SELECT COUNT(*) as count FROM receivables').get();
if (count.count === 0) {
  const seed = [
    {
      invoice_number: 'FAC-1001',
      customer_name: 'Distribuidora Andina',
      document_number: '900123456',
      amount: 2450000,
      invoice_date: '2026-09-10',
      due_date: '2026-10-15',
      status: 'Pendiente',
      review_notes: 'Factura por entrega de mercadería.',
      treasury_notes: '',
      radicado_number: null,
      receipt_number: null,
      receipt_date: null
    },
    {
      invoice_number: 'FAC-1002',
      customer_name: 'Constructora El Sol',
      document_number: '890987654',
      amount: 8750000,
      invoice_date: '2026-09-20',
      due_date: '2026-09-22',
      status: 'En revisión',
      review_notes: 'Se revisa soporte de pago con vencimiento anterior.',
      treasury_notes: '',
      radicado_number: null,
      receipt_number: null,
      receipt_date: null
    },
    {
      invoice_number: 'FAC-1003',
      customer_name: 'Servicios Logísticos',
      document_number: '901112233',
      amount: 3200000,
      invoice_date: '2026-09-15',
      due_date: '2026-11-01',
      status: 'Radicada',
      review_notes: 'Cobro gestionado por área jurídica.',
      treasury_notes: 'Enviar a tesorería para gestionar pago.',
      radicado_number: 'RAD-20261008-1',
      receipt_number: null,
      receipt_date: null
    },
    {
      invoice_number: 'FAC-1004',
      customer_name: 'Comercial XYZ',
      document_number: '800456789',
      amount: 980000,
      invoice_date: '2026-08-12',
      due_date: '2026-08-30',
      status: 'Pago registrado',
      review_notes: 'Factura con conciliación previa.',
      treasury_notes: 'Recibo entregado a cliente.',
      radicado_number: 'RAD-20260901-2',
      receipt_number: 'RC-2026-0145',
      receipt_date: '2026-08-28'
    }
  ];

  const insert = db.prepare(`
    INSERT INTO receivables (
      invoice_number,
      customer_name,
      document_number,
      amount,
      invoice_date,
      due_date,
      status,
      radicado_number,
      review_notes,
      treasury_notes,
      receipt_number,
      receipt_date,
      created_at,
      updated_at
    ) VALUES (
      @invoice_number,
      @customer_name,
      @document_number,
      @amount,
      @invoice_date,
      @due_date,
      @status,
      @radicado_number,
      @review_notes,
      @treasury_notes,
      @receipt_number,
      @receipt_date,
      datetime('now'),
      datetime('now')
    )
  `);

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });

  insertMany(seed);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function generateRadicadoNumber(id) {
  const now = new Date();
  const pad = String(id).padStart(4, '0');
  return `RAD-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${pad}`;
}

app.get('/api/summary', (req, res) => {
  const totals = db.prepare(`
    SELECT COUNT(*) as total_count, COALESCE(SUM(amount), 0) as total_amount
    FROM receivables
  `).get();

  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
    FROM receivables
    GROUP BY status
    ORDER BY status
  `).all();

  res.json({ total_count: totals.total_count, total_amount: totals.total_amount, by_status: byStatus });
});

app.get('/api/invoices', (req, res) => {
  const rows = db.prepare(`
    SELECT *
    FROM receivables
    ORDER BY created_at DESC
  `).all();
  res.json(rows);
});

app.get('/api/invoices/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM receivables WHERE id = ?').get(req.params.id);
  if (!item) {
    return res.status(404).json({ message: 'Factura no encontrada.' });
  }
  res.json(item);
});

app.post('/api/invoices', (req, res) => {
  const { invoice_number, customer_name, document_number, amount, invoice_date, due_date, review_notes } = req.body;

  if (!invoice_number || !customer_name || !document_number || !amount || !invoice_date || !due_date) {
    return res.status(400).json({ message: 'Faltan campos obligatorios.' });
  }

  const result = db.prepare(`
    INSERT INTO receivables (
      invoice_number,
      customer_name,
      document_number,
      amount,
      invoice_date,
      due_date,
      status,
      review_notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'Pendiente', ?, datetime('now'), datetime('now'))
  `).run(
    invoice_number.trim(),
    customer_name.trim(),
    document_number.trim(),
    Number(amount),
    invoice_date,
    due_date,
    (review_notes || '').trim()
  );

  const created = db.prepare('SELECT * FROM receivables WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

app.patch('/api/invoices/:id', (req, res) => {
  const { status, review_notes, treasury_notes, receipt_number, receipt_date } = req.body;
  const existing = db.prepare('SELECT * FROM receivables WHERE id = ?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ message: 'Factura no encontrada.' });
  }

  const allowed = ['Pendiente', 'En revisión', 'Radicada', 'Pago registrado', 'Rechazada', 'Vencida'];
  if (status && !allowed.includes(status)) {
    return res.status(400).json({ message: 'Estado no válido.' });
  }

  const nextStatus = status || existing.status;
  let nextRadicado = existing.radicado_number;

  if (nextStatus === 'Radicada' && !nextRadicado) {
    nextRadicado = generateRadicadoNumber(existing.id);
  }

  if (nextStatus === 'Pago registrado') {
    if (!receipt_number || !receipt_date) {
      return res.status(400).json({ message: 'Se requiere número y fecha de recibo de caja para registrar el pago.' });
    }
  }

  db.prepare(`
    UPDATE receivables
    SET status = ?,
        radicado_number = ?,
        review_notes = COALESCE(?, review_notes),
        treasury_notes = COALESCE(?, treasury_notes),
        receipt_number = ?,
        receipt_date = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    nextStatus,
    nextRadicado,
    review_notes !== undefined ? review_notes : existing.review_notes,
    treasury_notes !== undefined ? treasury_notes : existing.treasury_notes,
    receipt_number !== undefined ? receipt_number : existing.receipt_number,
    receipt_date !== undefined ? receipt_date : existing.receipt_date,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM receivables WHERE id = ?').get(req.params.id);
  res.json(updated);
});

app.get('/api/treasury/pending', (req, res) => {
  const rows = db.prepare(`
    SELECT *
    FROM receivables
    WHERE status = 'Radicada'
    ORDER BY updated_at DESC
  `).all();
  res.json(rows);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Aplicación corriendo en http://localhost:${PORT}`);
});
