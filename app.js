const STORAGE_KEY = 'gestao_empresa_pro_v2';

const state = {
  jobs: [],
  clients: [],
  payments: [],
  useFirebase: false,
};

const els = {};

document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  bindEvents();
  loadData();
  renderAll();
});

function cacheElements() {
  [
    'jobForm','jobId','cliente','contacto','tipoTrabalho','valor','dataInicio','dataFim','estado','descricao',
    'jobsTableBody','searchJobs','filterEstado','clearJobForm',
    'clientForm','clientId','clientNome','clientTelefone','clientEmail','clientNif','clientMorada','clientsList','searchClients','clearClientForm',
    'paymentForm','paymentId','paymentCliente','paymentTrabalho','paymentValor','paymentData','paymentMetodo','paymentNotas','paymentsList','clearPaymentForm',
    'statTotalTrabalhos','statEmAndamento','statConcluidos','statFaturado','recentJobs','monthlySummary','reportMonthly',
    'pageTitle','pageSubtitle','menuBtn','sidebar','exportJobsCsv','exportClientsCsv','exportPaymentsCsv','exportBackupBtn','importBackupBtn','backupFileInput','useFirebaseToggle'
  ].forEach(id => els[id] = document.getElementById(id));
}

function bindEvents() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPage(btn.dataset.page));
  });

  els.menuBtn.addEventListener('click', () => els.sidebar.classList.toggle('open'));

  els.jobForm.addEventListener('submit', saveJob);
  els.clientForm.addEventListener('submit', saveClient);
  els.paymentForm.addEventListener('submit', savePayment);
  els.searchJobs.addEventListener('input', renderJobs);
  els.filterEstado.addEventListener('change', renderJobs);
  els.searchClients.addEventListener('input', renderClients);
  els.clearJobForm.addEventListener('click', clearJobForm);
  els.clearClientForm.addEventListener('click', clearClientForm);
  els.clearPaymentForm.addEventListener('click', clearPaymentForm);

  els.exportJobsCsv.addEventListener('click', () => exportCsv('trabalhos.csv', state.jobs));
  els.exportClientsCsv.addEventListener('click', () => exportCsv('clientes.csv', state.clients));
  els.exportPaymentsCsv.addEventListener('click', () => exportCsv('pagamentos.csv', state.payments));
  els.exportBackupBtn.addEventListener('click', exportBackup);
  els.importBackupBtn.addEventListener('click', () => els.backupFileInput.click());
  els.backupFileInput.addEventListener('change', importBackup);
  els.useFirebaseToggle.addEventListener('change', () => {
    state.useFirebase = els.useFirebaseToggle.checked;
    saveData();
    alert(state.useFirebase
      ? 'Modo Firebase ativado. Completa primeiro o firebase-config.js e a integração.'
      : 'Modo local ativado.');
  });
}

function switchPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelector(`.nav-btn[data-page="${page}"]`).classList.add('active');
  els.sidebar.classList.remove('open');

  const titles = {
    dashboard: ['Dashboard', 'Resumo rápido da atividade'],
    trabalhos: ['Trabalhos', 'Registo e gestão de serviços'],
    clientes: ['Clientes', 'Base de clientes da empresa'],
    pagamentos: ['Pagamentos', 'Controlo de recebimentos'],
    relatorios: ['Relatórios', 'Exportações e visão mensal'],
    config: ['Configurações', 'Ajustes da aplicação'],
  };
  const [title, subtitle] = titles[page];
  els.pageTitle.textContent = title;
  els.pageSubtitle.textContent = subtitle;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.jobs = parsed.jobs || [];
    state.clients = parsed.clients || [];
    state.payments = parsed.payments || [];
    state.useFirebase = !!parsed.useFirebase;
    els.useFirebaseToggle.checked = state.useFirebase;
  } catch (e) {
    console.error('Erro ao carregar dados', e);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function saveJob(e) {
  e.preventDefault();
  const job = {
    id: els.jobId.value || uid(),
    cliente: els.cliente.value.trim(),
    contacto: els.contacto.value.trim(),
    tipoTrabalho: els.tipoTrabalho.value.trim(),
    valor: Number(els.valor.value || 0),
    dataInicio: els.dataInicio.value,
    dataFim: els.dataFim.value,
    estado: els.estado.value,
    descricao: els.descricao.value.trim(),
    createdAt: new Date().toISOString(),
  };

  const index = state.jobs.findIndex(x => x.id === job.id);
  if (index >= 0) state.jobs[index] = { ...state.jobs[index], ...job };
  else state.jobs.unshift(job);

  saveData();
  clearJobForm();
  renderAll();
  switchPage('trabalhos');
}

function saveClient(e) {
  e.preventDefault();
  const client = {
    id: els.clientId.value || uid(),
    nome: els.clientNome.value.trim(),
    telefone: els.clientTelefone.value.trim(),
    email: els.clientEmail.value.trim(),
    nif: els.clientNif.value.trim(),
    morada: els.clientMorada.value.trim(),
    createdAt: new Date().toISOString(),
  };
  const index = state.clients.findIndex(x => x.id === client.id);
  if (index >= 0) state.clients[index] = { ...state.clients[index], ...client };
  else state.clients.unshift(client);
  saveData();
  clearClientForm();
  renderClients();
}

function savePayment(e) {
  e.preventDefault();
  const payment = {
    id: els.paymentId.value || uid(),
    cliente: els.paymentCliente.value.trim(),
    trabalho: els.paymentTrabalho.value.trim(),
    valor: Number(els.paymentValor.value || 0),
    data: els.paymentData.value,
    metodo: els.paymentMetodo.value,
    notas: els.paymentNotas.value.trim(),
    createdAt: new Date().toISOString(),
  };
  const index = state.payments.findIndex(x => x.id === payment.id);
  if (index >= 0) state.payments[index] = { ...state.payments[index], ...payment };
  else state.payments.unshift(payment);
  saveData();
  clearPaymentForm();
  renderPayments();
  renderDashboard();
  renderReports();
}

function renderAll() {
  renderJobs();
  renderClients();
  renderPayments();
  renderDashboard();
  renderReports();
}

function renderJobs() {
  const q = (els.searchJobs.value || '').toLowerCase();
  const estado = els.filterEstado.value;
  const filtered = state.jobs.filter(job => {
    const matchQ = !q || job.cliente.toLowerCase().includes(q) || job.tipoTrabalho.toLowerCase().includes(q);
    const matchEstado = !estado || job.estado === estado;
    return matchQ && matchEstado;
  });

  els.jobsTableBody.innerHTML = filtered.length ? filtered.map(job => `
    <tr>
      <td>${escapeHtml(job.cliente)}</td>
      <td>${escapeHtml(job.tipoTrabalho)}</td>
      <td>${formatMoney(job.valor)}</td>
      <td>${formatDate(job.dataInicio)}</td>
      <td>${formatDate(job.dataFim)}</td>
      <td>${statusPill(job.estado)}</td>
      <td>
        <div class="actions">
          <button class="secondary" onclick="editJob('${job.id}')">Editar</button>
          <button class="danger" onclick="deleteJob('${job.id}')">Apagar</button>
        </div>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="7" class="muted">Sem trabalhos registados.</td></tr>`;
}

function renderClients() {
  const q = (els.searchClients.value || '').toLowerCase();
  const filtered = state.clients.filter(c => !q || c.nome.toLowerCase().includes(q) || (c.telefone || '').includes(q) || (c.email || '').toLowerCase().includes(q));
  els.clientsList.innerHTML = filtered.length ? filtered.map(c => `
    <div class="item-row">
      <div class="top">
        <strong>${escapeHtml(c.nome)}</strong>
        <div class="actions">
          <button class="secondary" onclick="editClient('${c.id}')">Editar</button>
          <button class="danger" onclick="deleteClient('${c.id}')">Apagar</button>
        </div>
      </div>
      <div class="meta">${escapeHtml(c.telefone || 'Sem telefone')} • ${escapeHtml(c.email || 'Sem email')}</div>
      <div class="meta">NIF: ${escapeHtml(c.nif || '---')}</div>
      <div class="meta">${escapeHtml(c.morada || 'Sem morada')}</div>
    </div>
  `).join('') : '<div class="muted">Sem clientes registados.</div>';
}

function renderPayments() {
  els.paymentsList.innerHTML = state.payments.length ? state.payments.map(p => `
    <div class="item-row">
      <div class="top">
        <strong>${escapeHtml(p.cliente)}</strong>
        <div class="actions">
          <button class="secondary" onclick="editPayment('${p.id}')">Editar</button>
          <button class="danger" onclick="deletePayment('${p.id}')">Apagar</button>
        </div>
      </div>
      <div class="meta">${escapeHtml(p.trabalho)} • ${formatMoney(p.valor)} • ${formatDate(p.data)}</div>
      <div class="meta">${escapeHtml(p.metodo)}${p.notas ? ' • ' + escapeHtml(p.notas) : ''}</div>
    </div>
  `).join('') : '<div class="muted">Sem pagamentos registados.</div>';
}

function renderDashboard() {
  const total = state.jobs.length;
  const emAndamento = state.jobs.filter(j => j.estado === 'Em andamento').length;
  const concluidos = state.jobs.filter(j => j.estado === 'Concluído' || j.estado === 'Pago').length;
  const faturado = state.jobs.reduce((acc, j) => acc + Number(j.valor || 0), 0);

  els.statTotalTrabalhos.textContent = total;
  els.statEmAndamento.textContent = emAndamento;
  els.statConcluidos.textContent = concluidos;
  els.statFaturado.textContent = formatMoney(faturado);

  const recent = [...state.jobs].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0,5);
  els.recentJobs.innerHTML = recent.length ? recent.map(j => `
    <div class="item-row">
      <div class="top">
        <strong>${escapeHtml(j.cliente)}</strong>
        ${statusPill(j.estado)}
      </div>
      <div class="meta">${escapeHtml(j.tipoTrabalho)} • ${formatMoney(j.valor)}</div>
      <div class="meta">${formatDate(j.dataInicio)} até ${formatDate(j.dataFim)}</div>
    </div>
  `).join('') : '<div class="muted">Ainda não existem trabalhos.</div>';

  const grouped = groupByMonth(state.jobs, 'dataInicio');
  els.monthlySummary.innerHTML = Object.keys(grouped).length ? Object.entries(grouped).map(([month, items]) => `
    <div class="item-row">
      <div class="top">
        <strong>${month}</strong>
        <span>${items.length} trabalho(s)</span>
      </div>
      <div class="meta">Total: ${formatMoney(items.reduce((a,b) => a + Number(b.valor || 0), 0))}</div>
    </div>
  `).join('') : '<div class="muted">Sem dados mensais.</div>';
}

function renderReports() {
  const grouped = groupByMonth(state.jobs, 'dataInicio');
  els.reportMonthly.innerHTML = Object.keys(grouped).length ? Object.entries(grouped).map(([month, items]) => {
    const total = items.reduce((a,b) => a + Number(b.valor || 0), 0);
    const pagos = items.filter(x => x.estado === 'Pago').length;
    return `
      <div class="item-row">
        <div class="top">
          <strong>${month}</strong>
          <span>${items.length} registo(s)</span>
        </div>
        <div class="meta">Total faturado: ${formatMoney(total)}</div>
        <div class="meta">Pagos: ${pagos} • Concluídos: ${items.filter(x => x.estado === 'Concluído').length}</div>
      </div>
    `;
  }).join('') : '<div class="muted">Ainda sem relatórios disponíveis.</div>';
}

function editJob(id) {
  const j = state.jobs.find(x => x.id === id);
  if (!j) return;
  els.jobId.value = j.id;
  els.cliente.value = j.cliente;
  els.contacto.value = j.contacto || '';
  els.tipoTrabalho.value = j.tipoTrabalho;
  els.valor.value = j.valor;
  els.dataInicio.value = j.dataInicio || '';
  els.dataFim.value = j.dataFim || '';
  els.estado.value = j.estado;
  els.descricao.value = j.descricao || '';
  switchPage('trabalhos');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function editClient(id) {
  const c = state.clients.find(x => x.id === id);
  if (!c) return;
  els.clientId.value = c.id;
  els.clientNome.value = c.nome;
  els.clientTelefone.value = c.telefone || '';
  els.clientEmail.value = c.email || '';
  els.clientNif.value = c.nif || '';
  els.clientMorada.value = c.morada || '';
  switchPage('clientes');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function editPayment(id) {
  const p = state.payments.find(x => x.id === id);
  if (!p) return;
  els.paymentId.value = p.id;
  els.paymentCliente.value = p.cliente;
  els.paymentTrabalho.value = p.trabalho;
  els.paymentValor.value = p.valor;
  els.paymentData.value = p.data || '';
  els.paymentMetodo.value = p.metodo || 'Dinheiro';
  els.paymentNotas.value = p.notas || '';
  switchPage('pagamentos');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteJob(id) {
  if (!confirm('Apagar este trabalho?')) return;
  state.jobs = state.jobs.filter(x => x.id !== id);
  saveData();
  renderAll();
}
function deleteClient(id) {
  if (!confirm('Apagar este cliente?')) return;
  state.clients = state.clients.filter(x => x.id !== id);
  saveData();
  renderClients();
}
function deletePayment(id) {
  if (!confirm('Apagar este pagamento?')) return;
  state.payments = state.payments.filter(x => x.id !== id);
  saveData();
  renderPayments();
  renderDashboard();
  renderReports();
}

function clearJobForm() { els.jobForm.reset(); els.jobId.value = ''; }
function clearClientForm() { els.clientForm.reset(); els.clientId.value = ''; }
function clearPaymentForm() { els.paymentForm.reset(); els.paymentId.value = ''; }

function exportCsv(filename, rows) {
  if (!rows.length) return alert('Não existem dados para exportar.');
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(',')]
    .concat(rows.map(row => headers.map(h => csvValue(row[h])).join(',')))
    .join('\n');
  downloadFile(filename, 'text/csv;charset=utf-8;', csv);
}

function exportBackup() {
  downloadFile('gestao-empresa-backup.json', 'application/json', JSON.stringify(state, null, 2));
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      state.jobs = parsed.jobs || [];
      state.clients = parsed.clients || [];
      state.payments = parsed.payments || [];
      state.useFirebase = !!parsed.useFirebase;
      els.useFirebaseToggle.checked = state.useFirebase;
      saveData();
      renderAll();
      alert('Backup importado com sucesso.');
    } catch {
      alert('Ficheiro inválido.');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function groupByMonth(items, field) {
  return items.reduce((acc, item) => {
    if (!item[field]) return acc;
    const date = new Date(item[field]);
    if (Number.isNaN(date.getTime())) return acc;
    const key = date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}

function statusPill(status) {
  const cls = status === 'Pendente' ? 'pendente'
    : status === 'Em andamento' ? 'andamento'
    : status === 'Concluído' ? 'concluido'
    : 'pago';
  return `<span class="pill ${cls}">${escapeHtml(status)}</span>`;
}

function formatMoney(value) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return 'Sem data';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('pt-PT');
}

function csvValue(v) {
  const s = String(v ?? '').replace(/"/g, '""');
  return `"${s}"`;
}

function downloadFile(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

window.editJob = editJob;
window.deleteJob = deleteJob;
window.editClient = editClient;
window.deleteClient = deleteClient;
window.editPayment = editPayment;
window.deletePayment = deletePayment;
