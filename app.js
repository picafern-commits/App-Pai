const STORAGE_KEY = 'gestao_empresa_trabalhos_v1';
const EDIT_KEY = 'gestao_empresa_edit_id';

const state = {
  jobs: loadJobs(),
  currentView: 'dashboard',
};

const els = {
  pageTitle: document.getElementById('pageTitle'),
  pageSubtitle: document.getElementById('pageSubtitle'),
  navBtns: document.querySelectorAll('.nav-btn'),
  views: document.querySelectorAll('.view'),
  sidebar: document.querySelector('.sidebar'),
  mobileMenuBtn: document.getElementById('mobileMenuBtn'),
  jobForm: document.getElementById('jobForm'),
  submitBtn: document.getElementById('submitBtn'),
  clearBtn: document.getElementById('clearBtn'),
  searchInput: document.getElementById('searchInput'),
  filterEstado: document.getElementById('filterEstado'),
  jobsTableWrap: document.getElementById('jobsTableWrap'),
  recentList: document.getElementById('recentList'),
  estadoResumo: document.getElementById('estadoResumo'),
  toast: document.getElementById('toast'),
  exportBtn: document.getElementById('exportBtn'),
  clearAllBtn: document.getElementById('clearAllBtn'),
  statTotal: document.getElementById('statTotal'),
  statPendentes: document.getElementById('statPendentes'),
  statConcluidos: document.getElementById('statConcluidos'),
  statFaturado: document.getElementById('statFaturado'),
  fields: {
    cliente: document.getElementById('cliente'),
    contacto: document.getElementById('contacto'),
    tipoTrabalho: document.getElementById('tipoTrabalho'),
    valor: document.getElementById('valor'),
    dataInicio: document.getElementById('dataInicio'),
    dataFim: document.getElementById('dataFim'),
    estado: document.getElementById('estado'),
    descricao: document.getElementById('descricao'),
  }
};

init();

function init() {
  bindEvents();
  renderAll();
}

function bindEvents() {
  els.navBtns.forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
  els.mobileMenuBtn.addEventListener('click', () => els.sidebar.classList.toggle('open'));
  els.jobForm.addEventListener('submit', onSubmitJob);
  els.clearBtn.addEventListener('click', resetForm);
  els.searchInput.addEventListener('input', renderJobsTable);
  els.filterEstado.addEventListener('change', renderJobsTable);
  els.exportBtn.addEventListener('click', exportData);
  els.clearAllBtn.addEventListener('click', clearAllData);
}

function switchView(viewName) {
  state.currentView = viewName;

  els.navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));
  els.views.forEach(view => view.classList.toggle('active', view.id === `view-${viewName}`));

  const titles = {
    dashboard: ['Dashboard', 'Resumo rápido da atividade'],
    novo: ['Novo Trabalho', 'Regista um novo serviço'],
    trabalhos: ['Trabalhos', 'Consulta e gere todos os registos'],
    config: ['Configurações', 'Ferramentas e opções desta versão'],
  };

  els.pageTitle.textContent = titles[viewName][0];
  els.pageSubtitle.textContent = titles[viewName][1];
  els.sidebar.classList.remove('open');
}

function onSubmitJob(e) {
  e.preventDefault();

  const data = getFormData();
  if (!data) return;

  const editingId = sessionStorage.getItem(EDIT_KEY);

  if (editingId) {
    state.jobs = state.jobs.map(job => job.id === editingId ? { ...job, ...data, updatedAt: new Date().toISOString() } : job);
    sessionStorage.removeItem(EDIT_KEY);
    showToast('Trabalho atualizado com sucesso.');
  } else {
    state.jobs.unshift({
      id: crypto.randomUUID(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    showToast('Trabalho guardado com sucesso.');
  }

  persistJobs();
  resetForm();
  renderAll();
  switchView('trabalhos');
}

function getFormData() {
  const data = {
    cliente: els.fields.cliente.value.trim(),
    contacto: els.fields.contacto.value.trim(),
    tipoTrabalho: els.fields.tipoTrabalho.value.trim(),
    valor: Number(els.fields.valor.value || 0),
    dataInicio: els.fields.dataInicio.value,
    dataFim: els.fields.dataFim.value,
    estado: els.fields.estado.value,
    descricao: els.fields.descricao.value.trim(),
  };

  if (!data.cliente || !data.tipoTrabalho || !data.dataInicio || !data.dataFim || !data.valor) {
    showToast('Preenche cliente, tipo, valor e datas.');
    return null;
  }

  if (data.dataFim < data.dataInicio) {
    showToast('A data de fim não pode ser inferior à data de início.');
    return null;
  }

  return data;
}

function resetForm() {
  els.jobForm.reset();
  sessionStorage.removeItem(EDIT_KEY);
  els.submitBtn.textContent = 'Guardar trabalho';
}

function renderAll() {
  renderDashboard();
  renderJobsTable();
}

function renderDashboard() {
  const total = state.jobs.length;
  const pendentes = state.jobs.filter(j => j.estado === 'Pendente').length;
  const concluidos = state.jobs.filter(j => j.estado === 'Concluído' || j.estado === 'Pago').length;
  const faturado = state.jobs.reduce((sum, job) => sum + Number(job.valor || 0), 0);

  els.statTotal.textContent = String(total);
  els.statPendentes.textContent = String(pendentes);
  els.statConcluidos.textContent = String(concluidos);
  els.statFaturado.textContent = formatCurrency(faturado);

  const recent = state.jobs.slice(0, 5);
  if (!recent.length) {
    els.recentList.innerHTML = '<div class="empty-state">Ainda não existem trabalhos registados.</div>';
  } else {
    els.recentList.innerHTML = recent.map(job => `
      <div class="list-item">
        <div class="list-item-top">
          <strong>${escapeHtml(job.cliente)}</strong>
          <span class="badge ${job.estado}">${escapeHtml(job.estado)}</span>
        </div>
        <div>${escapeHtml(job.tipoTrabalho)} • ${formatCurrency(job.valor)}</div>
        <small>${formatDate(job.dataInicio)} → ${formatDate(job.dataFim)}</small>
      </div>
    `).join('');
  }

  const estados = ['Pendente', 'Em andamento', 'Concluído', 'Pago'];
  els.estadoResumo.innerHTML = estados.map(estado => {
    const items = state.jobs.filter(j => j.estado === estado);
    const totalValor = items.reduce((sum, item) => sum + Number(item.valor || 0), 0);
    return `
      <div class="mini-card">
        <span>${estado}</span>
        <strong>${items.length} trabalho(s)</strong>
        <div>${formatCurrency(totalValor)}</div>
      </div>
    `;
  }).join('');
}

function renderJobsTable() {
  const query = (els.searchInput.value || '').trim().toLowerCase();
  const estado = els.filterEstado.value;

  const filtered = state.jobs.filter(job => {
    const matchesQuery = !query ||
      job.cliente.toLowerCase().includes(query) ||
      job.tipoTrabalho.toLowerCase().includes(query);
    const matchesEstado = !estado || job.estado === estado;
    return matchesQuery && matchesEstado;
  });

  if (!filtered.length) {
    els.jobsTableWrap.innerHTML = '<div class="empty-state">Nenhum trabalho encontrado.</div>';
    return;
  }

  els.jobsTableWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Cliente</th>
          <th>Tipo</th>
          <th>Valor</th>
          <th>Início</th>
          <th>Fim</th>
          <th>Estado</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map(job => `
          <tr>
            <td>
              <strong>${escapeHtml(job.cliente)}</strong><br />
              <small>${escapeHtml(job.contacto || 'Sem contacto')}</small>
            </td>
            <td>${escapeHtml(job.tipoTrabalho)}</td>
            <td>${formatCurrency(job.valor)}</td>
            <td>${formatDate(job.dataInicio)}</td>
            <td>${formatDate(job.dataFim)}</td>
            <td><span class="badge ${job.estado}">${escapeHtml(job.estado)}</span></td>
            <td>
              <div class="table-actions">
                <button class="small-btn" onclick="editJob('${job.id}')">Editar</button>
                <button class="small-btn delete" onclick="deleteJob('${job.id}')">Apagar</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function editJob(id) {
  const job = state.jobs.find(j => j.id === id);
  if (!job) return;

  els.fields.cliente.value = job.cliente;
  els.fields.contacto.value = job.contacto || '';
  els.fields.tipoTrabalho.value = job.tipoTrabalho;
  els.fields.valor.value = job.valor;
  els.fields.dataInicio.value = job.dataInicio;
  els.fields.dataFim.value = job.dataFim;
  els.fields.estado.value = job.estado;
  els.fields.descricao.value = job.descricao || '';

  sessionStorage.setItem(EDIT_KEY, id);
  els.submitBtn.textContent = 'Atualizar trabalho';
  switchView('novo');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.editJob = editJob;

function deleteJob(id) {
  const confirmed = confirm('Queres apagar este trabalho?');
  if (!confirmed) return;

  state.jobs = state.jobs.filter(job => job.id !== id);
  persistJobs();
  renderAll();
  showToast('Trabalho apagado.');
}
window.deleteJob = deleteJob;

function exportData() {
  const blob = new Blob([JSON.stringify(state.jobs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'trabalhos-gestao-empresa.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exportação iniciada.');
}

function clearAllData() {
  const confirmed = confirm('Queres mesmo apagar todos os dados?');
  if (!confirmed) return;

  state.jobs = [];
  persistJobs();
  renderAll();
  resetForm();
  showToast('Todos os dados foram apagados.');
}

function loadJobs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function persistJobs() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.jobs));
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => els.toast.classList.remove('show'), 2200);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-PT').format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
