
import { firebaseConfig } from './firebase-config.js';

const STORAGE_KEYS = {
  trabalhos: 'ge_trabalhos',
  clientes: 'ge_clientes',
  pagamentos: 'ge_pagamentos'
};

let db = null;
let dataMode = 'Local';

let trabalhos = [];
let clientes = [];
let pagamentos = [];

const pageTitle = document.getElementById('pageTitle');
const navButtons = document.querySelectorAll('.nav-btn');
const bottomButtons = document.querySelectorAll('.bottom-btn');
const pages = document.querySelectorAll('.page');

function setDataModeLabel(){
  document.getElementById('dataModeLabel').textContent = dataMode;
  document.getElementById('settingsModeLabel').textContent = dataMode;
}

function switchTab(tab){
  navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  bottomButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  pages.forEach(page => page.classList.toggle('active', page.id === `${tab}-page`));
  const btn = document.querySelector(`.nav-btn[data-tab="${tab}"]`);
  pageTitle.textContent = btn ? btn.textContent.trim() : 'Dashboard';
  document.getElementById('sidebar').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

navButtons.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
bottomButtons.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
document.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.go)));
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

function uid(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}
function euro(value){
  const n = Number(value || 0);
  return n.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}
function fmtDate(value){
  if(!value) return '-';
  const d = new Date(value);
  return isNaN(d) ? '-' : d.toLocaleDateString('pt-PT');
}
function escapeHtml(str=''){
  return String(str).replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

function loadLocal(){
  try { trabalhos = JSON.parse(localStorage.getItem(STORAGE_KEYS.trabalhos)) || []; } catch { trabalhos = []; }
  try { clientes = JSON.parse(localStorage.getItem(STORAGE_KEYS.clientes)) || []; } catch { clientes = []; }
  try { pagamentos = JSON.parse(localStorage.getItem(STORAGE_KEYS.pagamentos)) || []; } catch { pagamentos = []; }
}
function saveLocal(){
  localStorage.setItem(STORAGE_KEYS.trabalhos, JSON.stringify(trabalhos));
  localStorage.setItem(STORAGE_KEYS.clientes, JSON.stringify(clientes));
  localStorage.setItem(STORAGE_KEYS.pagamentos, JSON.stringify(pagamentos));
}

async function tryInitFirebase(){
  if(!firebaseConfig){
    dataMode = 'Local';
    setDataModeLabel();
    return false;
  }

  try{
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const {
      getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc
    } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);

    window.firebaseApi = { collection, getDocs, addDoc, updateDoc, deleteDoc, doc };
    dataMode = 'Firebase';
    setDataModeLabel();
    return true;
  }catch(error){
    console.error('Firebase indisponível:', error);
    dataMode = 'Local';
    setDataModeLabel();
    return false;
  }
}

async function fetchCollection(name){
  const { collection, getDocs } = window.firebaseApi;
  const snap = await getDocs(collection(db, name));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadData(){
  const ok = await tryInitFirebase();
  if(ok){
    try{
      trabalhos = await fetchCollection('trabalhos');
      clientes = await fetchCollection('clientes');
      pagamentos = await fetchCollection('pagamentos');
      return;
    }catch(error){
      console.error('Erro ao ler Firebase, a voltar para local:', error);
    }
  }
  loadLocal();
}

async function persistItem(collectionName, item){
  if(dataMode !== 'Firebase' || !db){
    return false;
  }
  const { collection, addDoc, updateDoc, doc } = window.firebaseApi;
  if(item.id && !item.id.startsWith('local_')){
    await updateDoc(doc(db, collectionName, item.id), { ...item });
  }else{
    const { id, ...payload } = item;
    const created = await addDoc(collection(db, collectionName), payload);
    item.id = created.id;
  }
  return true;
}

async function persistDelete(collectionName, id){
  if(dataMode !== 'Firebase' || !db || !id || id.startsWith('local_')){
    return false;
  }
  const { deleteDoc, doc } = window.firebaseApi;
  await deleteDoc(doc(db, collectionName, id));
  return true;
}

function getIdWithFallback(id){
  return id || ('local_' + uid());
}

function renderDashboard(){
  const totalTrabalhos = trabalhos.length;
  const emAndamento = trabalhos.filter(t => t.estado === 'Em andamento' || t.estado === 'Pendente').length;
  const concluidos = trabalhos.filter(t => t.estado === 'Concluído' || t.estado === 'Pago').length;
  const totalFaturado = trabalhos.reduce((sum, t) => sum + Number(t.valor || 0), 0);

  document.getElementById('statTotalTrabalhos').textContent = totalTrabalhos;
  document.getElementById('statEmAndamento').textContent = emAndamento;
  document.getElementById('statConcluidos').textContent = concluidos;
  document.getElementById('statTotalFaturado').textContent = euro(totalFaturado);

  const recentWrap = document.getElementById('recentTrabalhos');
  if(!trabalhos.length){
    recentWrap.innerHTML = '<div class="recent-item">Ainda não tens trabalhos registados.</div>';
  }else{
    recentWrap.innerHTML = [...trabalhos].slice(-5).reverse().map(t => `
      <div class="recent-item">
        <div class="eyebrow">${escapeHtml(t.estado || 'Sem estado')}</div>
        <strong>${escapeHtml(t.cliente || '-')}</strong>
        <div>${escapeHtml(t.tipoTrabalho || '-')}</div>
        <div class="recent-meta">${euro(t.valor || 0)} • ${fmtDate(t.dataInicio)} → ${fmtDate(t.dataFim)}</div>
      </div>
    `).join('');
  }

  const monthMap = {};
  trabalhos.forEach(t => {
    if(!t.dataInicio) return;
    const d = new Date(t.dataInicio);
    if(isNaN(d)) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    monthMap[key] = (monthMap[key] || 0) + Number(t.valor || 0);
  });
  const entries = Object.entries(monthMap).sort((a,b) => a[0].localeCompare(b[0])).slice(-6);
  const max = Math.max(...entries.map(([,v]) => v), 1);
  const bars = document.getElementById('monthlyBars');

  if(!entries.length){
    bars.innerHTML = '<div class="recent-item">Sem dados mensais ainda.</div>';
  }else{
    bars.innerHTML = entries.map(([month, value]) => `
      <div class="bar-row">
        <span>${month}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(value/max)*100}%"></div></div>
        <strong>${euro(value)}</strong>
      </div>
    `).join('');
  }
}

function renderTrabalhos(){
  const term = document.getElementById('searchTrabalhos').value.trim().toLowerCase();
  const estado = document.getElementById('filterEstado').value;
  const body = document.getElementById('trabalhosTableBody');

  const rows = trabalhos.filter(t => {
    const a = (t.cliente || '').toLowerCase();
    const b = (t.tipoTrabalho || '').toLowerCase();
    return (!term || a.includes(term) || b.includes(term)) && (!estado || t.estado === estado);
  });

  if(!rows.length){
    body.innerHTML = '<tr><td colspan="7">Sem resultados.</td></tr>';
    return;
  }

  body.innerHTML = rows.slice().reverse().map(t => `
    <tr>
      <td>${escapeHtml(t.cliente || '-')}</td>
      <td>${escapeHtml(t.tipoTrabalho || '-')}</td>
      <td>${euro(t.valor || 0)}</td>
      <td>${fmtDate(t.dataInicio)}</td>
      <td>${fmtDate(t.dataFim)}</td>
      <td><span class="badge">${escapeHtml(t.estado || '-')}</span></td>
      <td>
        <div class="row-actions">
          <button class="small-btn" onclick="editTrabalho('${t.id}')">Editar</button>
          <button class="small-btn danger" onclick="deleteTrabalho('${t.id}')">Apagar</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderClientes(){
  const term = document.getElementById('searchClientes').value.trim().toLowerCase();
  const body = document.getElementById('clientesTableBody');
  const rows = clientes.filter(c => {
    const a = (c.nome || '').toLowerCase();
    const b = (c.telefone || '').toLowerCase();
    return !term || a.includes(term) || b.includes(term);
  });

  if(!rows.length){
    body.innerHTML = '<tr><td colspan="5">Sem clientes registados.</td></tr>';
    return;
  }

  body.innerHTML = rows.slice().reverse().map(c => `
    <tr>
      <td>${escapeHtml(c.nome || '-')}</td>
      <td>${escapeHtml(c.telefone || '-')}</td>
      <td>${escapeHtml(c.email || '-')}</td>
      <td>${escapeHtml(c.nif || '-')}</td>
      <td>
        <div class="row-actions">
          <button class="small-btn" onclick="editCliente('${c.id}')">Editar</button>
          <button class="small-btn danger" onclick="deleteCliente('${c.id}')">Apagar</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderPagamentos(){
  const body = document.getElementById('pagamentosTableBody');
  if(!pagamentos.length){
    body.innerHTML = '<tr><td colspan="6">Sem pagamentos registados.</td></tr>';
    return;
  }

  body.innerHTML = pagamentos.slice().reverse().map(p => `
    <tr>
      <td>${escapeHtml(p.cliente || '-')}</td>
      <td>${escapeHtml(p.referencia || '-')}</td>
      <td>${euro(p.valor || 0)}</td>
      <td>${fmtDate(p.data)}</td>
      <td>${escapeHtml(p.metodo || '-')}</td>
      <td>
        <div class="row-actions">
          <button class="small-btn" onclick="editPagamento('${p.id}')">Editar</button>
          <button class="small-btn danger" onclick="deletePagamento('${p.id}')">Apagar</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderRelatorios(){
  const el = document.getElementById('resumoMensal');
  const monthMap = {};

  trabalhos.forEach(t => {
    const source = t.dataInicio || t.dataFim;
    if(!source) return;
    const d = new Date(source);
    if(isNaN(d)) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    monthMap[key] = monthMap[key] || { trabalhos: 0, faturado: 0 };
    monthMap[key].trabalhos += 1;
    monthMap[key].faturado += Number(t.valor || 0);
  });

  const entries = Object.entries(monthMap).sort((a,b) => b[0].localeCompare(a[0]));
  if(!entries.length){
    el.innerHTML = '<div class="report-card">Sem dados para relatório.</div>';
    return;
  }

  el.innerHTML = entries.map(([month, data]) => `
    <div class="report-card">
      <div class="mini-label">${month}</div>
      <div>Trabalhos</div>
      <strong>${data.trabalhos}</strong>
      <div class="recent-meta">Faturado: ${euro(data.faturado)}</div>
    </div>
  `).join('');
}

function renderAll(){
  renderDashboard();
  renderTrabalhos();
  renderClientes();
  renderPagamentos();
  renderRelatorios();
}

document.getElementById('searchTrabalhos').addEventListener('input', renderTrabalhos);
document.getElementById('filterEstado').addEventListener('change', renderTrabalhos);
document.getElementById('searchClientes').addEventListener('input', renderClientes);

document.getElementById('clearTrabalhoBtn').addEventListener('click', () => {
  document.getElementById('trabalhoForm').reset();
  document.getElementById('trabalhoId').value = '';
});
document.getElementById('clearClienteBtn').addEventListener('click', () => {
  document.getElementById('clienteForm').reset();
  document.getElementById('clienteId').value = '';
});
document.getElementById('clearPagamentoBtn').addEventListener('click', () => {
  document.getElementById('pagamentoForm').reset();
  document.getElementById('pagamentoId').value = '';
});

document.getElementById('trabalhoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const item = {
    id: getIdWithFallback(document.getElementById('trabalhoId').value),
    cliente: document.getElementById('cliente').value.trim(),
    contacto: document.getElementById('contacto').value.trim(),
    tipoTrabalho: document.getElementById('tipoTrabalho').value.trim(),
    valor: Number(document.getElementById('valor').value || 0),
    dataInicio: document.getElementById('dataInicio').value,
    dataFim: document.getElementById('dataFim').value,
    estado: document.getElementById('estado').value,
    descricao: document.getElementById('descricao').value.trim()
  };
  if(!item.cliente || !item.tipoTrabalho){
    alert('Preenche cliente e tipo de trabalho.');
    return;
  }

  const i = trabalhos.findIndex(x => x.id === item.id);
  if(i >= 0) trabalhos[i] = item; else trabalhos.push(item);

  try{
    const savedToFirebase = await persistItem('trabalhos', item);
    if(!savedToFirebase) saveLocal();
  }catch(error){
    console.error(error);
    saveLocal();
  }

  document.getElementById('trabalhoForm').reset();
  document.getElementById('trabalhoId').value = '';
  renderAll();
});

document.getElementById('clienteForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const item = {
    id: getIdWithFallback(document.getElementById('clienteId').value),
    nome: document.getElementById('clienteNome').value.trim(),
    telefone: document.getElementById('clienteTelefone').value.trim(),
    email: document.getElementById('clienteEmail').value.trim(),
    nif: document.getElementById('clienteNif').value.trim(),
    morada: document.getElementById('clienteMorada').value.trim()
  };
  if(!item.nome){
    alert('Preenche o nome do cliente.');
    return;
  }

  const i = clientes.findIndex(x => x.id === item.id);
  if(i >= 0) clientes[i] = item; else clientes.push(item);

  try{
    const savedToFirebase = await persistItem('clientes', item);
    if(!savedToFirebase) saveLocal();
  }catch(error){
    console.error(error);
    saveLocal();
  }

  document.getElementById('clienteForm').reset();
  document.getElementById('clienteId').value = '';
  renderAll();
});

document.getElementById('pagamentoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const item = {
    id: getIdWithFallback(document.getElementById('pagamentoId').value),
    cliente: document.getElementById('pagamentoCliente').value.trim(),
    referencia: document.getElementById('pagamentoReferencia').value.trim(),
    valor: Number(document.getElementById('pagamentoValor').value || 0),
    data: document.getElementById('pagamentoData').value,
    metodo: document.getElementById('pagamentoMetodo').value,
    notas: document.getElementById('pagamentoNotas').value.trim()
  };
  if(!item.cliente){
    alert('Preenche o cliente do pagamento.');
    return;
  }

  const i = pagamentos.findIndex(x => x.id === item.id);
  if(i >= 0) pagamentos[i] = item; else pagamentos.push(item);

  try{
    const savedToFirebase = await persistItem('pagamentos', item);
    if(!savedToFirebase) saveLocal();
  }catch(error){
    console.error(error);
    saveLocal();
  }

  document.getElementById('pagamentoForm').reset();
  document.getElementById('pagamentoId').value = '';
  renderAll();
});

window.editTrabalho = function(id){
  const t = trabalhos.find(x => x.id === id);
  if(!t) return;
  document.getElementById('trabalhoId').value = t.id;
  document.getElementById('cliente').value = t.cliente || '';
  document.getElementById('contacto').value = t.contacto || '';
  document.getElementById('tipoTrabalho').value = t.tipoTrabalho || '';
  document.getElementById('valor').value = t.valor || '';
  document.getElementById('dataInicio').value = t.dataInicio || '';
  document.getElementById('dataFim').value = t.dataFim || '';
  document.getElementById('estado').value = t.estado || 'Pendente';
  document.getElementById('descricao').value = t.descricao || '';
  switchTab('trabalhos');
};

window.deleteTrabalho = async function(id){
  if(!confirm('Apagar este trabalho?')) return;
  trabalhos = trabalhos.filter(x => x.id !== id);
  try{
    const deleted = await persistDelete('trabalhos', id);
    if(!deleted) saveLocal();
  }catch(error){
    console.error(error);
    saveLocal();
  }
  renderAll();
};

window.editCliente = function(id){
  const c = clientes.find(x => x.id === id);
  if(!c) return;
  document.getElementById('clienteId').value = c.id;
  document.getElementById('clienteNome').value = c.nome || '';
  document.getElementById('clienteTelefone').value = c.telefone || '';
  document.getElementById('clienteEmail').value = c.email || '';
  document.getElementById('clienteNif').value = c.nif || '';
  document.getElementById('clienteMorada').value = c.morada || '';
  switchTab('clientes');
};

window.deleteCliente = async function(id){
  if(!confirm('Apagar este cliente?')) return;
  clientes = clientes.filter(x => x.id !== id);
  try{
    const deleted = await persistDelete('clientes', id);
    if(!deleted) saveLocal();
  }catch(error){
    console.error(error);
    saveLocal();
  }
  renderAll();
};

window.editPagamento = function(id){
  const p = pagamentos.find(x => x.id === id);
  if(!p) return;
  document.getElementById('pagamentoId').value = p.id;
  document.getElementById('pagamentoCliente').value = p.cliente || '';
  document.getElementById('pagamentoReferencia').value = p.referencia || '';
  document.getElementById('pagamentoValor').value = p.valor || '';
  document.getElementById('pagamentoData').value = p.data || '';
  document.getElementById('pagamentoMetodo').value = p.metodo || 'Dinheiro';
  document.getElementById('pagamentoNotas').value = p.notas || '';
  switchTab('pagamentos');
};

window.deletePagamento = async function(id){
  if(!confirm('Apagar este pagamento?')) return;
  pagamentos = pagamentos.filter(x => x.id !== id);
  try{
    const deleted = await persistDelete('pagamentos', id);
    if(!deleted) saveLocal();
  }catch(error){
    console.error(error);
    saveLocal();
  }
  renderAll();
};

function exportBackup(){
  const payload = {
    exportadoEm: new Date().toISOString(),
    dataMode,
    trabalhos,
    clientes,
    pagamentos
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gestao-empresa-backup.json';
  a.click();
  URL.revokeObjectURL(a.href);
}
document.getElementById('exportBackupBtn').addEventListener('click', exportBackup);
document.getElementById('exportBackupBtn2').addEventListener('click', exportBackup);

document.getElementById('syncBtn').addEventListener('click', async () => {
  await loadData();
  renderAll();
  alert(dataMode === 'Firebase'
    ? 'Firebase ligado com sucesso.'
    : 'Ainda está em modo local. Confirma o ficheiro js/firebase-config.js.');
});

await loadData();
setDataModeLabel();
renderAll();
