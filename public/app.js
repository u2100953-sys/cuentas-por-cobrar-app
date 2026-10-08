const statsContainer = document.getElementById('stats');
const receivablesBody = document.getElementById('receivables-body');
const treasuryBody = document.getElementById('treasury-body');
const invoiceForm = document.getElementById('invoice-form');

const statusMap = {
  Pendiente: 'Pendiente',
  'En revisión': 'En revisión',
  Radicada: 'Radicada',
  'Pago registrado': 'Pago registrado',
  Rechazada: 'Rechazada',
  Vencida: 'Vencida'
};

const statusClassMap = {
  Pendiente: 'status-pendiente',
  'En revisión': 'status-en-revision',
  Radicada: 'status-radicada',
  'Pago registrado': 'status-pago-registrado',
  Rechazada: 'status-rechazada',
  Vencida: 'status-vencida'
};

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(Number(value));
}

function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString + 'T00:00:00').toLocaleDateString('es-CO');
}

async function loadSummary() {
  const response = await fetch('/api/summary');
  const data = await response.json();

  const cards = [
    { label: 'Total de facturas', value: data.total_count },
    { label: 'Monto total', value: formatCurrency(data.total_amount) },
    { label: 'Pendientes', value: data.by_status.find(item => item.status === 'Pendiente')?.count || 0 },
    { label: 'Radicadas', value: data.by_status.find(item => item.status === 'Radicada')?.count || 0 }
  ];

  statsContainer.innerHTML = cards.map(card => `
    <div class="stat-card">
      <div class="stat-label">${card.label}</div>
      <div class="stat-value">${card.value}</div>
    </div>
  `).join('');
}

async function loadInvoices() {
  const response = await fetch('/api/invoices');
  const data = await response.json();

  receivablesBody.innerHTML = data.map(item => `
    <tr>
      <td>${item.invoice_number}</td>
      <td>${item.customer_name}</td>
      <td>${formatCurrency(item.amount)}</td>
      <td>${formatDate(item.due_date)}</td>
      <td>
        <span class="status-badge ${statusClassMap[item.status] || ''}">
          ${statusMap[item.status] || item.status}
        </span>
      </td>
      <td>${item.radicado_number || '-'}</td>
      <td>${item.review_notes || '-'}</td>
      <td>
        <div class="actions">
          <button class="action-btn" data-id="${item.id}" data-action="review">Revisar</button>
          <button class="action-btn warning" data-id="${item.id}" data-action="radicar">Radicar</button>
          <button class="action-btn danger" data-id="${item.id}" data-action="reject">Rechazar</button>
        </div>
      </td>
    </tr>
  `).join('');

  const pending = data.filter(item => item.status === 'Radicada');
  treasuryBody.innerHTML = pending.length === 0
    ? '<tr><td colspan="7">No hay facturas pendientes por pagar.</td></tr>'
    : pending.map(item => `
      <tr>
        <td>${item.invoice_number}</td>
        <td>${item.customer_name}</td>
        <td>${item.radicado_number}</td>
        <td>${formatCurrency(item.amount)}</td>
        <td>
          <div class="input-inline">
            <input type="text" data-receipt-id="${item.id}" placeholder="N° recibo" />
          </div>
        </td>
        <td>
          <div class="input-inline">
            <input type="date" data-receipt-date-id="${item.id}" />
          </div>
        </td>
        <td>
          <button class="action-btn success" data-id="${item.id}" data-action="payment">Registrar pago</button>
        </td>
      </tr>
    `).join('');
}

async function updateInvoice(id, payload) {
  const response = await fetch(`/api/invoices/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    alert(data.message || 'No se pudo actualizar la factura.');
    return;
  }

  await loadSummary();
  await loadInvoices();
}

invoiceForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(invoiceForm);
  const payload = Object.fromEntries(formData.entries());

  const response = await fetch('/api/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoice_number: payload.invoice_number,
      customer_name: payload.customer_name,
      document_number: payload.document_number,
      amount: Number(payload.amount),
      invoice_date: payload.invoice_date,
      due_date: payload.due_date,
      review_notes: payload.review_notes
    })
  });

  const result = await response.json();
  if (!response.ok) {
    alert(result.message || 'Error al registrar la factura.');
    return;
  }

  invoiceForm.reset();
  await loadSummary();
  await loadInvoices();
});

document.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === 'review') {
    await updateInvoice(id, { status: 'En revisión' });
  }

  if (action === 'radicar') {
    await updateInvoice(id, { status: 'Radicada', treasury_notes: 'Factura enviada a tesorería para pago.' });
  }

  if (action === 'reject') {
    await updateInvoice(id, { status: 'Rechazada', review_notes: 'Factura rechazada por validación documental.' });
  }

  if (action === 'payment') {
    const receiptNumberInput = document.querySelector(`[data-receipt-id="${id}"]`);
    const receiptDateInput = document.querySelector(`[data-receipt-date-id="${id}"]`);
    const receiptNumber = receiptNumberInput ? receiptNumberInput.value.trim() : '';
    const receiptDate = receiptDateInput ? receiptDateInput.value : '';

    if (!receiptNumber || !receiptDate) {
      alert('Debe ingresar el número y la fecha del recibo de caja para registrar el pago.');
      return;
    }

    await updateInvoice(id, {
      status: 'Pago registrado',
      receipt_number: receiptNumber,
      receipt_date: receiptDate,
      treasury_notes: 'Pago realizado con recibo de caja registrado por tesorería.'
    });
  }
});

async function init() {
  await loadSummary();
  await loadInvoices();
}

init();
