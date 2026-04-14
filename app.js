import { firebaseSettings } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const state = {
  jobs: [],
  db: null,
  onlineDb: false
};

const els = {
  menuBtns: document.querySelectorAll('.menu-btn'),
  pages: document.querySelectorAll('.page'),
  pageTitle: document.getElementById('pageTitle'),
  dbStatus: document.getElementById('dbStatus'),
  syncBtn: document.getElementById('syncBtn'),
  jobForm: document.getElementById('jobForm'),
  formTitle: document.getElementById('formTitle'),
  cancelEditBtn: document.getElementById('cancelEditBtn'),
  jobsTableBody: document.getElementById('jobsTableBody'),
  recentList: document.getElementById('recentList'),
  searchCliente: document.getElementById('searchCliente'),
  filterEstado: document.getElementById('filterEstado'),
  toast: document.getElementById('toast'),
  metricTotal: document.getElementById('metricTotal'),
  metricValor: document.getElementById('metricValor'),
  metricAndamento: document.getElementById('metricAndamento'),
  metricConcluidos: document.getElementById('metricConcluidos'),
  jobId: document.getElementById('jobId'),
  cliente: document.getElementById('cliente'),
  contacto: document.getElementById('contacto'),
  tipoTrabalho: document.getElementById('tipoTrabalho'),
  valor: document.getElementById('valor'),
  dataInicio: document.getElementById('dataInicio'),
  dataFim: document.getElementById('dataFim'),
  estado: document.getElementById('estado'),
  descricao: document.getElementById('descricao')
};

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  setTimeout(() => els.toast.classList.add('hidden'), 2500);
}

function hasFirebaseConfig() {
  return firebaseSettings.projectId && !String(firebaseSettings.projectId).includes('COLOCA_AQUI');
}

function saveLocal() {
  localStorage.setItem('gestaoEmpresaJobs', JSON.stringify(state.jobs));
}

function loadLocal() {
  try {
    state.jobs = JSON.parse(localStorage.getItem('gestaoEmpresaJobs') || '[]');
  } catch {
    state.jobs = [];
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-PT');
}

function statusClass(status) {
  if (status === 'Pendente') return 'pendente';
  if (status === 'Em andamento') return 'andamento';
  if (status === 'Concluído') return 'concluido';
  if (status === 'Pago') return 'pago';
  return '';
}

function renderDashboard() {
  const total = state.jobs.length;
  const totalValor = state.jobs.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const andamento = state.jobs.filter(item => item.estado === 'Em andamento').length;
  const concluidos = state.jobs.filter(item => item.estado === 'Concluído').length;

  els.metricTotal.textContent = total;
  els.metricValor.textContent = formatCurrency(totalValor);
  els.metricAndamento.textContent = andamento;
  els.metricConcluidos.textContent = concluidos;

  const recent = [...state.jobs]
    .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
    .slice(0, 5);

  if (!recent.length) {
    els.recentList.innerHTML = '<div class="empty-state">Sem trabalhos registados.</div>';
    return;
  }

  els.recentList.innerHTML = recent.map(item => `
    <div class="recent-item" style="padding:12px 0;border-bottom:1px solid var(--line)">
      <strong>${item.cliente}</strong> · ${item.tipoTrabalho}<br>
      <span style="color:var(--muted)">${formatCurrency(item.valor)} · ${item.estado} · ${formatDate(item.dataInicio)}</span>
    </div>
  `).join('');
}

function getFilteredJobs() {
  const text = els.searchCliente.value.trim().toLowerCase();
  const estado = els.filterEstado.value;

  return state.jobs.filter(item => {
    const matchText = !text || item.cliente.toLowerCase().includes(text);
    const matchEstado = !estado || item.estado === estado;
    return matchText && matchEstado;
  }).sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
}

function renderJobs() {
  const jobs = getFilteredJobs();
  if (!jobs.length) {
    els.jobsTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">Sem resultados.</td></tr>';
    return;
  }

  els.jobsTableBody.innerHTML = jobs.map(item => `
    <tr>
      <td>${item.cliente}</td>
      <td>${item.tipoTrabalho}</td>
      <td>${formatCurrency(item.valor)}</td>
      <td>${formatDate(item.dataInicio)}</td>
      <td>${formatDate(item.dataFim)}</td>
      <td><span class="tag ${statusClass(item.estado)}">${item.estado}</span></td>
      <td>
        <div class="actions">
          <button class="small-btn" data-edit="${item.id}">Editar</button>
          <button class="danger-btn small-btn" data-delete="${item.id}">Apagar</button>
        </div>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => startEdit(btn.dataset.edit));
  });
  document.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => removeJob(btn.dataset.delete));
  });
}

function renderAll() {
  renderDashboard();
  renderJobs();
}

function switchPage(pageId) {
  els.pages.forEach(page => page.classList.toggle('active', page.id === `page-${pageId}`));
  els.menuBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.page === pageId));
  const activeBtn = [...els.menuBtns].find(btn => btn.dataset.page === pageId);
  els.pageTitle.textContent = activeBtn ? activeBtn.textContent : 'Gestão Empresa';
}

async function initFirebase() {
  if (!hasFirebaseConfig()) {
    loadLocal();
    state.onlineDb = false;
    els.dbStatus.textContent = 'Modo local ativo. Falta configurar Firebase.';
    renderAll();
    return;
  }

  try {
    const app = initializeApp(firebaseSettings);
    state.db = getFirestore(app);
    state.onlineDb = true;
    els.dbStatus.textContent = 'Firebase ligado com sucesso.';
    await fetchJobs();
  } catch (error) {
    console.error(error);
    loadLocal();
    state.onlineDb = false;
    els.dbStatus.textContent = 'Erro no Firebase. App em modo local.';
    renderAll();
  }
}

async function fetchJobs() {
  if (!state.onlineDb) {
    loadLocal();
    renderAll();
    return;
  }

  const jobsRef = collection(state.db, 'trabalhos');
  const q = query(jobsRef, orderBy('createdAtMs', 'desc'));
  const snapshot = await getDocs(q);
  state.jobs = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  saveLocal();
  renderAll();
}

function getFormData() {
  return {
    cliente: els.cliente.value.trim(),
    contacto: els.contacto.value.trim(),
    tipoTrabalho: els.tipoTrabalho.value.trim(),
    valor: Number(els.valor.value || 0),
    dataInicio: els.dataInicio.value,
    dataFim: els.dataFim.value,
    estado: els.estado.value,
    descricao: els.descricao.value.trim()
  };
}

function resetForm() {
  els.jobForm.reset();
  els.jobId.value = '';
  els.formTitle.textContent = 'Novo Trabalho';
  els.cancelEditBtn.classList.add('hidden');
}

async function upsertJob(event) {
  event.preventDefault();
  const data = getFormData();
  if (!data.cliente || !data.tipoTrabalho || !data.dataInicio || !data.dataFim) {
    showToast('Preenche os campos obrigatórios.');
    return;
  }

  const editingId = els.jobId.value;

  if (state.onlineDb) {
    if (editingId) {
      await updateDoc(doc(state.db, 'trabalhos', editingId), data);
      showToast('Trabalho atualizado.');
    } else {
      await addDoc(collection(state.db, 'trabalhos'), {
        ...data,
        createdAt: serverTimestamp(),
        createdAtMs: Date.now()
      });
      showToast('Trabalho guardado.');
    }
    await fetchJobs();
  } else {
    if (editingId) {
      state.jobs = state.jobs.map(item => item.id === editingId ? { ...item, ...data } : item);
      showToast('Trabalho atualizado em modo local.');
    } else {
      state.jobs.unshift({ id: crypto.randomUUID(), ...data, createdAtMs: Date.now() });
      showToast('Trabalho guardado em modo local.');
    }
    saveLocal();
    renderAll();
  }

  resetForm();
  switchPage('trabalhos');
}

function startEdit(id) {
  const job = state.jobs.find(item => item.id === id);
  if (!job) return;

  els.jobId.value = job.id;
  els.cliente.value = job.cliente || '';
  els.contacto.value = job.contacto || '';
  els.tipoTrabalho.value = job.tipoTrabalho || '';
  els.valor.value = job.valor ?? '';
  els.dataInicio.value = job.dataInicio || '';
  els.dataFim.value = job.dataFim || '';
  els.estado.value = job.estado || 'Pendente';
  els.descricao.value = job.descricao || '';
  els.formTitle.textContent = 'Editar Trabalho';
  els.cancelEditBtn.classList.remove('hidden');
  switchPage('novo');
}

async function removeJob(id) {
  const ok = confirm('Queres apagar este registo?');
  if (!ok) return;

  if (state.onlineDb) {
    await deleteDoc(doc(state.db, 'trabalhos', id));
    await fetchJobs();
    showToast('Trabalho apagado.');
  } else {
    state.jobs = state.jobs.filter(item => item.id !== id);
    saveLocal();
    renderAll();
    showToast('Trabalho apagado em modo local.');
  }
}

els.menuBtns.forEach(btn => btn.addEventListener('click', () => switchPage(btn.dataset.page)));
els.syncBtn.addEventListener('click', fetchJobs);
els.jobForm.addEventListener('submit', upsertJob);
els.cancelEditBtn.addEventListener('click', resetForm);
els.searchCliente.addEventListener('input', renderJobs);
els.filterEstado.addEventListener('change', renderJobs);

initFirebase();
