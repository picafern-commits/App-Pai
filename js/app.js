const APP_VERSION = '5.1.8';
const STORAGE_KEYS = {
  trabalhos: 'ge_trabalhos',
  clientes: 'ge_clientes',
  pagamentos: 'ge_pagamentos'
};

const USERS = [
  { username: 'Ricardo', password: '2297', role: 'master_admin' },
  { username: 'admin', password: 'admin123', role: 'admin' },
  { username: 'user', password: 'user123', role: 'user' }
];

let currentRole = null;
let currentUsername = null;
let trabalhos = [];
let clientes = [];
let pagamentos = [];

const $ = (id) => document.getElementById(id);
const navButtons = document.querySelectorAll('.nav-btn');
const bottomButtons = document.querySelectorAll('.bottom-btn');
const pages = document.querySelectorAll('.page');

const euro = (v) =>
  Number(v || 0).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

const fmtDate = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-PT');
};

const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));

const isMasterAdmin = () => currentRole === 'master_admin';
const isAdminLike = () => currentRole === 'admin' || currentRole === 'master_admin';

function loadLocal() {
  try {
    trabalhos = JSON.parse(localStorage.getItem(STORAGE_KEYS.trabalhos)) || [];
  } catch {
    trabalhos = [];
  }

  try {
    clientes = JSON.parse(localStorage.getItem(STORAGE_KEYS.clientes)) || [];
  } catch {
    clientes = [];
  }

  try {
    pagamentos = JSON.parse(localStorage.getItem(STORAGE_KEYS.pagamentos)) || [];
  } catch {
    pagamentos = [];
  }
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEYS.trabalhos, JSON.stringify(trabalhos));
  localStorage.setItem(STORAGE_KEYS.clientes, JSON.stringify(clientes));
  localStorage.setItem(STORAGE_KEYS.pagamentos, JSON.stringify(pagamentos));
}

function setRoleUI() {
  if (!currentRole) return;

  const roleLabel =
    currentRole === 'master_admin'
      ? 'Admin Mestre'
      : currentRole === 'admin'
        ? 'Admin'
        : 'User';

  document.body.classList.toggle('role-view-user', currentRole === 'user');
  document.body.classList.toggle('role-view-admin', currentRole === 'admin');

  if ($('roleBadge')) $('roleBadge').textContent = roleLabel;
  if ($('roleLine')) $('roleLine').textContent = `Role: ${roleLabel}`;
  if ($('modeLine')) $('modeLine').textContent = 'Modo: Local';
  if ($('versionBadge')) $('versionBadge').textContent = APP_VERSION;
  if ($('currentUserName')) $('currentUserName').textContent = currentUsername || 'Utilizador';

  const usersSection = $('usersSection');
  if (usersSection) {
    usersSection.style.display = isMasterAdmin() ? 'block' : 'none';
  }
}

function switchTab(tab) {
  navButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  bottomButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  pages.forEach((p) => p.classList.toggle('active', p.id === `${tab}-page`));

  const btn = document.querySelector(`.nav-btn[data-tab="${tab}"]`);
  if ($('pageTitle')) {
    $('pageTitle').textContent = btn ? btn.textContent.trim() : 'Dashboard';
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

navButtons.forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
bottomButtons.forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
document.querySelectorAll('[data-go]').forEach((b) => {
  b.addEventListener('click', () => switchTab(b.dataset.go));
});

function adminGuard() {
  if (!isAdminLike()) {
    alert('Só o Admin pode fazer alterações.');
    return false;
  }
  return true;
}

function printHtml(title, bodyHtml) {
  const win = window.open('', '_blank');
  if (!win) return;

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body{font-family:Arial,sans-serif;padding:32px;color:#111}
          h1,h2{margin:0 0 10px}
          .meta{color:#555;margin-bottom:20px}
          .card{border:1px solid #ddd;border-radius:12px;padding:18px;margin:12px 0}
          table{width:100%;border-collapse:collapse;margin-top:12px}
          th,td{border-bottom:1px solid #ddd;padding:10px;text-align:left}
        </style>
      </head>
      <body>${bodyHtml}</body>
    </html>
  `);

  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
  }, 300);
}

function renderDashboard() {
  if ($('statTotalTrabalhos')) {
    $('statTotalTrabalhos').textContent = trabalhos.length;
  }

  if ($('statEmAndamento')) {
    $('statEmAndamento').textContent = trabalhos.filter(
      (t) => t.estado === 'Em andamento' || t.estado === 'Pendente'
    ).length;
  }

  if ($('statConcluidos')) {
    $('statConcluidos').textContent = trabalhos.filter(
      (t) => t.estado === 'Concluído' || t.estado === 'Pago'
    ).length;
  }

  if ($('statTotalFaturado')) {
    $('statTotalFaturado').textContent = euro(
      trabalhos.reduce((s, t) => s + Number(t.valor || 0), 0)
    );
  }

  const recentWrap = $('recentTrabalhos');
  if (recentWrap) {
    recentWrap.innerHTML = !trabalhos.length
      ? '<div class="recent-item">Ainda não tens trabalhos registados.</div>'
      : [...trabalhos]
          .slice(-5)
          .reverse()
          .map(
            (t) => `
              <div class="recent-item">
                <div class="mini-label">${escapeHtml(t.estado || 'Sem estado')}</div>
                <strong>${escapeHtml(t.cliente || '-')}</strong>
                <div>${escapeHtml(t.tipoTrabalho || '-')}</div>
                <div class="recent-meta">${euro(t.valor || 0)} • ${fmtDate(t.dataInicio)} → ${fmtDate(t.dataFim)}</div>
              </div>
            `
          )
          .join('');
  }

  const monthMap = {};
  trabalhos.forEach((t) => {
    if (!t.dataInicio) return;
    const d = new Date(t.dataInicio);
    if (Number.isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap[key] = (monthMap[key] || 0) + Number(t.valor || 0);
  });

  const entries = Object.entries(monthMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6);

  const max = Math.max(...entries.map(([, v]) => v), 1);

  const monthlyBars = $('monthlyBars');
  if (monthlyBars) {
    monthlyBars.innerHTML = entries.length
      ? entries
          .map(
            ([m, v]) => `
              <div class="bar-row">
                <span>${m}</span>
                <div class="bar-track">
                  <div class="bar-fill" style="width:${(v / max) * 100}%"></div>
                </div>
                <strong>${euro(v)}</strong>
              </div>
            `
          )
          .join('')
      : '<div class="recent-item">Sem dados mensais ainda.</div>';
  }
}

function renderAlerts() {
  const pend = trabalhos.filter((t) => t.estado === 'Pendente').length;
  const andam = trabalhos.filter((t) => t.estado === 'Em andamento').length;
  const semFim = trabalhos.filter((t) => !t.dataFim).length;

  const alertCards = $('alertCards');
  if (!alertCards) return;

  alertCards.innerHTML = `
    <div class="alert-card">
      <span class="mini-label">Pendentes</span>
      <strong>${pend}</strong>
      <p>Trabalhos ainda por arrancar ou fechar.</p>
    </div>
    <div class="alert-card">
      <span class="mini-label">Em andamento</span>
      <strong>${andam}</strong>
      <p>Serviços que precisam de acompanhamento.</p>
    </div>
    <div class="alert-card">
      <span class="mini-label">Sem data fim</span>
      <strong>${semFim}</strong>
      <p>Registos que convém completar.</p>
    </div>
  `;
}

function trabalhoActions(t) {
  const showInvoice = (t.invoiceType || 'Com Fatura') === 'Com Fatura';

  return `
    <div class="row-actions">
      ${showInvoice ? `<button class="btn-action primary" onclick="generateInvoice('${t.id}')">Fatura</button>` : ''}
      <button class="btn-action" onclick="editTrabalho('${t.id}')">Editar</button>
      <button class="btn-action success" onclick="markAsPaid('${t.id}')">Pago ✔</button>
      <button class="btn-action danger icon" onclick="deleteTrabalho('${t.id}')">🗑</button>
    </div>
  `;
}

function clienteActions(c) {
  const pdf = `<button class="small-btn" onclick="pdfCliente('${c.id}')">PDF</button>`;
  return !isAdminLike()
    ? pdf
    : `${pdf}<button class="small-btn" onclick="editCliente('${c.id}')">Editar</button><button class="small-btn danger" onclick="deleteCliente('${c.id}')">Apagar</button>`;
}

function pagamentoActions() {
  return '';
}

function renderTrabalhos() {
  const term = $('searchTrabalhos') ? $('searchTrabalhos').value.trim().toLowerCase() : '';
  const estado = $('filterEstado') ? $('filterEstado').value : '';

  const rows = trabalhos.filter((t) => {
    const a = (t.cliente || '').toLowerCase();
    const b = (t.tipoTrabalho || '').toLowerCase();
    return (!term || a.includes(term) || b.includes(term)) && (!estado || t.estado === estado);
  });

  const tbody = $('trabalhosTableBody');
  if (!tbody) return;

  tbody.innerHTML = rows.length
    ? rows
        .slice()
        .reverse()
        .map(
          (t) => `
            <tr>
              <td>${escapeHtml(t.cliente || '-')}</td>
              <td>${escapeHtml(t.tipoTrabalho || '-')}</td>
              <td>${euro(t.valor || 0)}</td>
              <td>${fmtDate(t.dataInicio)}</td>
              <td>${fmtDate(t.dataFim)}</td>
              <td><span class="badge">${escapeHtml(t.estado || '-')}</span></td>
              <td><div class="row-actions">${trabalhoActions(t)}</div></td>
            </tr>
          `
        )
        .join('')
    : '<tr><td colspan="7">Sem resultados.</td></tr>';
}

function renderClientes() {
  const term = $('searchClientes') ? $('searchClientes').value.trim().toLowerCase() : '';

  const rows = clientes.filter((c) => {
    const a = (c.nome || '').toLowerCase();
    const b = (c.telefone || '').toLowerCase();
    return !term || a.includes(term) || b.includes(term);
  });

  const tbody = $('clientesTableBody');
  if (!tbody) return;

  tbody.innerHTML = rows.length
    ? rows
        .slice()
        .reverse()
        .map(
          (c) => `
            <tr>
              <td>${escapeHtml(c.nome || '-')}</td>
              <td>${escapeHtml(c.telefone || '-')}</td>
              <td>${escapeHtml(c.email || '-')}</td>
              <td>${escapeHtml(c.nif || '-')}</td>
              <td><div class="row-actions">${clienteActions(c)}</div></td>
            </tr>
          `
        )
        .join('')
    : '<tr><td colspan="5">Sem clientes registados.</td></tr>';
}

function renderPagamentos() {
  const tbody = $('pagamentosTableBody');
  if (!tbody) return;

  tbody.innerHTML = pagamentos.length
    ? pagamentos
        .slice()
        .reverse()
        .map(
          (p) => `
            <tr>
              <td>${escapeHtml(p.cliente || '-')}</td>
              <td>${escapeHtml(p.referencia || '-')}</td>
              <td>${euro(p.valor || 0)}</td>
              <td>${fmtDate(p.data)}</td>
              <td>${escapeHtml(p.metodo || '-')}</td>
              <td>${escapeHtml(p.invoiceType || '-')}</td>
            </tr>
          `
        )
        .join('')
    : '<tr><td colspan="6">Sem pagamentos registados.</td></tr>';
}

function renderRelatorios() {
  const monthMap = {};

  trabalhos.forEach((t) => {
    const source = t.dataInicio || t.dataFim;
    if (!source) return;
    const d = new Date(source);
    if (Number.isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap[key] = monthMap[key] || { trabalhos: 0, faturado: 0 };
    monthMap[key].trabalhos += 1;
    monthMap[key].faturado += Number(t.valor || 0);
  });

  const entries = Object.entries(monthMap).sort((a, b) => b[0].localeCompare(a[0]));

  const resumoMensal = $('resumoMensal');
  if (!resumoMensal) return;

  resumoMensal.innerHTML = entries.length
    ? entries
        .map(
          ([m, d]) => `
            <div class="report-card">
              <div class="mini-label">${m}</div>
              <div>Trabalhos</div>
              <strong>${d.trabalhos}</strong>
              <div class="recent-meta">Faturado: ${euro(d.faturado)}</div>
            </div>
          `
        )
        .join('')
    : '<div class="report-card">Sem dados para relatório.</div>';
}

function renderAll() {
  if (!currentRole) return;
  setRoleUI();
  renderDashboard();
  renderAlerts();
  renderTrabalhos();
  renderClientes();
  renderPagamentos();
  renderRelatorios();
}

window.editTrabalho = function (id) {
  if (!adminGuard()) return;
  const t = trabalhos.find((x) => x.id === id);
  if (!t) return;

  $('trabalhoId').value = t.id;
  $('cliente').value = t.cliente || '';
  $('contacto').value = t.contacto || '';
  $('tipoTrabalho').value = t.tipoTrabalho || '';
  $('valor').value = t.valor || '';
  $('dataInicio').value = t.dataInicio || '';
  $('dataFim').value = t.dataFim || '';
  $('estado').value = t.estado || 'Pendente';

  if ($('trabalhoInvoiceType')) {
    $('trabalhoInvoiceType').value = t.invoiceType || 'Com Fatura';
  }

  $('descricao').value = t.descricao || '';
  switchTab('trabalhos');
};

window.deleteTrabalho = function (id) {
  if (!adminGuard()) return;
  if (!confirm('Apagar este trabalho?')) return;
  trabalhos = trabalhos.filter((x) => x.id !== id);
  saveLocal();
  renderAll();
};

window.editCliente = function (id) {
  if (!adminGuard()) return;
  const c = clientes.find((x) => x.id === id);
  if (!c) return;

  $('clienteId').value = c.id;
  $('clienteNome').value = c.nome || '';
  $('clienteTelefone').value = c.telefone || '';
  $('clienteEmail').value = c.email || '';
  $('clienteNif').value = c.nif || '';
  $('clienteMorada').value = c.morada || '';
  switchTab('clientes');
};

window.deleteCliente = function (id) {
  if (!adminGuard()) return;
  if (!confirm('Apagar este cliente?')) return;
  clientes = clientes.filter((x) => x.id !== id);
  saveLocal();
  renderAll();
};

window.generateInvoice = function (id) {
  const t = trabalhos.find((x) => x.id === id);
  if (!t) return;

  const invoiceType = t.invoiceType || 'Com Fatura';
  if (invoiceType === 'Sem Fatura') {
    alert('Este trabalho está marcado como Sem Fatura.');
    return;
  }

  const counter = Number(localStorage.getItem('invoice_counter') || 1);
  const invoiceNumber = `FT-${new Date().getFullYear()}-${String(counter).padStart(4, '0')}`;
  localStorage.setItem('invoice_counter', String(counter + 1));

  printHtml(
    `Fatura ${invoiceNumber}`,
    `
      <h1>Jorge Torneiro</h1>
      <div class="meta">${invoiceNumber}</div>
      <div class="card"><strong>Cliente:</strong> ${escapeHtml(t.cliente || '-')}</div>
      <div class="card"><strong>Serviço:</strong> ${escapeHtml(t.tipoTrabalho || '-')}</div>
      <div class="card"><strong>Contacto:</strong> ${escapeHtml(t.contacto || '-')}</div>
      <div class="card"><strong>Data:</strong> ${fmtDate(t.dataInicio)} até ${fmtDate(t.dataFim)}</div>
      <div class="card"><strong>Valor:</strong> ${euro(t.valor || 0)}</div>
      <div class="card"><strong>Observações:</strong><br>${escapeHtml(t.descricao || '-')}</div>
    `
  );
};

function markAsPaid(id) {
  const t = trabalhos.find((x) => x.id === id);
  if (!t) return;

  if (!confirm('Marcar este trabalho como pago?')) return;

  t.estado = 'Pago';

  if (!t.dataFim) {
    t.dataFim = new Date().toISOString().split('T')[0];
  }

  pagamentos.push({
    id: 'pay_' + Date.now(),
    cliente: t.cliente || '',
    referencia: t.tipoTrabalho || '',
    valor: Number(t.valor || 0),
    data: new Date().toISOString().split('T')[0],
    metodo: 'Manual',
    invoiceType: t.invoiceType || 'Com Fatura',
    notas: 'Gerado ao marcar como pago'
  });

  saveLocal();
  renderAll();
}

window.pdfTrabalho = function (id) {
  const t = trabalhos.find((x) => x.id === id);
  if (!t) return;

  printHtml(
    `Trabalho ${t.cliente}`,
    `
      <h1>Ficha de Trabalho</h1>
      <div class="meta">${escapeHtml(t.cliente || '-')} • ${escapeHtml(t.tipoTrabalho || '-')}</div>
      <div class="card"><strong>Cliente:</strong> ${escapeHtml(t.cliente || '-')}</div>
      <div class="card"><strong>Contacto:</strong> ${escapeHtml(t.contacto || '-')}</div>
      <div class="card"><strong>Tipo de trabalho:</strong> ${escapeHtml(t.tipoTrabalho || '-')}</div>
      <div class="card"><strong>Valor:</strong> ${euro(t.valor || 0)}</div>
      <div class="card"><strong>Início:</strong> ${fmtDate(t.dataInicio)}<br><strong>Fim:</strong> ${fmtDate(t.dataFim)}</div>
      <div class="card"><strong>Estado:</strong> ${escapeHtml(t.estado || '-')}</div>
      <div class="card"><strong>Descrição:</strong><br>${escapeHtml(t.descricao || '-')}</div>
    `
  );
};

window.pdfCliente = function (id) {
  const c = clientes.find((x) => x.id === id);
  if (!c) return;

  const trabalhosCliente = trabalhos.filter(
    (t) => (t.cliente || '').trim().toLowerCase() === (c.nome || '').trim().toLowerCase()
  );

  const linhas = trabalhosCliente
    .map(
      (t) => `
        <tr>
          <td>${escapeHtml(t.tipoTrabalho || '-')}</td>
          <td>${fmtDate(t.dataInicio)}</td>
          <td>${euro(t.valor || 0)}</td>
        </tr>
      `
    )
    .join('');

  printHtml(
    `Cliente ${c.nome}`,
    `
      <h1>Ficha de Cliente</h1>
      <div class="meta">${escapeHtml(c.nome || '-')}</div>
      <div class="card"><strong>Telefone:</strong> ${escapeHtml(c.telefone || '-')}</div>
      <div class="card"><strong>Email:</strong> ${escapeHtml(c.email || '-')}</div>
      <div class="card"><strong>NIF:</strong> ${escapeHtml(c.nif || '-')}</div>
      <div class="card"><strong>Morada:</strong><br>${escapeHtml(c.morada || '-')}</div>
      <h2>Trabalhos associados</h2>
      <table>
        <thead>
          <tr><th>Tipo</th><th>Data</th><th>Valor</th></tr>
        </thead>
        <tbody>
          ${linhas || '<tr><td colspan="3">Sem trabalhos associados</td></tr>'}
        </tbody>
      </table>
    `
  );
};

function exportBackup() {
  const payload = {
    exportadoEm: new Date().toISOString(),
    appVersion: APP_VERSION,
    currentUsername,
    currentRole,
    trabalhos,
    clientes,
    pagamentos
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gestao-empresa-backup.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

const loginForm = $('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const username = $('loginUsername').value.trim().toLowerCase();
    const password = $('loginPassword').value;

    const found = USERS.find(
      (u) => u.username.toLowerCase() === username && u.password === password
    );

    if (!found) {
      $('loginError').textContent = 'Credenciais inválidas.';
      return;
    }

    currentRole = found.role;
    currentUsername = found.username;

    loadLocal();

    $('loginError').textContent = '';
    $('loginScreen').classList.add('hidden');
    $('appRoot').classList.remove('hidden');

    setRoleUI();
    renderAll();
  });
}

if ($('logoutBtn')) {
  $('logoutBtn').addEventListener('click', () => {
    currentRole = null;
    currentUsername = null;
    $('loginScreen').classList.remove('hidden');
    $('appRoot').classList.add('hidden');
    if ($('loginForm')) $('loginForm').reset();
  });
}

if ($('searchTrabalhos')) $('searchTrabalhos').addEventListener('input', renderTrabalhos);
if ($('filterEstado')) $('filterEstado').addEventListener('change', renderTrabalhos);
if ($('searchClientes')) $('searchClientes').addEventListener('input', renderClientes);

if ($('clearTrabalhoBtn')) {
  $('clearTrabalhoBtn').addEventListener('click', () => {
    $('trabalhoForm').reset();
    $('trabalhoId').value = '';
    if ($('trabalhoInvoiceType')) {
      $('trabalhoInvoiceType').value = 'Com Fatura';
    }
  });
}

if ($('clearClienteBtn')) {
  $('clearClienteBtn').addEventListener('click', () => {
    $('clienteForm').reset();
    $('clienteId').value = '';
  });
}

if ($('trabalhoForm')) {
  $('trabalhoForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!adminGuard()) return;

    const item = {
      id: $('trabalhoId').value || `local_${Date.now().toString(36)}`,
      cliente: $('cliente').value.trim(),
      contacto: $('contacto').value.trim(),
      tipoTrabalho: $('tipoTrabalho').value.trim(),
      valor: Number($('valor').value || 0),
      dataInicio: $('dataInicio').value,
      dataFim: $('dataFim').value,
      estado: $('estado').value,
      invoiceType: $('trabalhoInvoiceType') ? $('trabalhoInvoiceType').value : 'Com Fatura',
      descricao: $('descricao').value.trim()
    };

    if (!item.cliente || !item.tipoTrabalho) {
      alert('Preenche cliente e tipo de trabalho.');
      return;
    }

    const i = trabalhos.findIndex((x) => x.id === item.id);
    if (i >= 0) {
      trabalhos[i] = item;
    } else {
      trabalhos.push(item);
    }

    saveLocal();
    $('trabalhoForm').reset();
    $('trabalhoId').value = '';

    if ($('trabalhoInvoiceType')) {
      $('trabalhoInvoiceType').value = 'Com Fatura';
    }

    renderAll();
  });
}

if ($('clienteForm')) {
  $('clienteForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!adminGuard()) return;

    const item = {
      id: $('clienteId').value || `local_${Date.now().toString(36)}`,
      nome: $('clienteNome').value.trim(),
      telefone: $('clienteTelefone').value.trim(),
      email: $('clienteEmail').value.trim(),
      nif: $('clienteNif').value.trim(),
      morada: $('clienteMorada').value.trim()
    };

    if (!item.nome) {
      alert('Preenche o nome do cliente.');
      return;
    }

    const i = clientes.findIndex((x) => x.id === item.id);
    if (i >= 0) {
      clientes[i] = item;
    } else {
      clientes.push(item);
    }

    saveLocal();
    $('clienteForm').reset();
    $('clienteId').value = '';
    renderAll();
  });
}

if ($('exportBackupBtn')) {
  $('exportBackupBtn').addEventListener('click', exportBackup);
}

if ($('exportMonthlyPdfBtn')) {
  $('exportMonthlyPdfBtn').addEventListener('click', () => {
    const html = $('resumoMensal') ? $('resumoMensal').innerHTML : '';
    printHtml(
      'Relatório mensal',
      `<h1>Relatório Mensal</h1><div style="display:grid;gap:14px">${html}</div>`
    );
  });
}
