
import { firebaseConfig } from './firebase-config.js';
import { authUsers } from './auth-config.js';

const APP_VERSION = '1.0.0';
const VERSION_KEY = 'ge_app_version_seen';
const STORAGE_KEYS = { trabalhos:'ge_trabalhos', clientes:'ge_clientes', pagamentos:'ge_pagamentos', role:'ge_role' };

let db = null;
let dataMode = 'Local';
let currentRole = null;

let trabalhos = [];
let clientes = [];
let pagamentos = [];

const loginScreen = document.getElementById('loginScreen');
const appRoot = document.getElementById('appRoot');
const pageTitle = document.getElementById('pageTitle');
const navButtons = document.querySelectorAll('.nav-btn');
const bottomButtons = document.querySelectorAll('.bottom-btn');
const pages = document.querySelectorAll('.page');

function $(id){ return document.getElementById(id); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function euro(value){ return Number(value||0).toLocaleString('pt-PT',{style:'currency',currency:'EUR'}); }
function fmtDate(value){ if(!value) return '-'; const d = new Date(value); return isNaN(d)?'-':d.toLocaleDateString('pt-PT'); }
function escapeHtml(str=''){ return String(str).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function setRoleUI(){
  if(!currentRole) return;
  document.body.classList.toggle('role-view-user', currentRole === 'user');
  $('roleBadge').textContent = currentRole === 'admin' ? 'Admin' : 'User';
  $('roleLine').textContent = `Role: ${currentRole === 'admin' ? 'Admin' : 'User'}`;
  $('modeLine').textContent = `Modo: ${dataMode}`;
  $('versionBadge').textContent = APP_VERSION;
}
function setModeUI(){
  $('modeLine').textContent = `Modo: ${dataMode}`;
}
function switchTab(tab){
  navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  bottomButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  pages.forEach(page => page.classList.toggle('active', page.id === `${tab}-page`));
  const btn = document.querySelector(`.nav-btn[data-tab="${tab}"]`);
  pageTitle.textContent = btn ? btn.textContent.trim() : 'Dashboard';
  const sidebar = $('sidebar');
  if (sidebar) sidebar.classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
navButtons.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
bottomButtons.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
document.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.go)));
$('menuToggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));

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
  if(!firebaseConfig){ dataMode = 'Local'; setModeUI(); return false; }
  try{
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    window.firebaseApi = { collection, getDocs, addDoc, updateDoc, deleteDoc, doc };
    dataMode = 'Firebase';
    setModeUI();
    return true;
  }catch(err){
    console.error('Firebase indisponível:', err);
    dataMode = 'Local';
    setModeUI();
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
    }catch(err){
      console.error('Erro a ler Firebase, a voltar para local:', err);
    }
  }
  loadLocal();
}
async function persistItem(collectionName, item){
  if(dataMode !== 'Firebase' || !db){ return false; }
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
  if(dataMode !== 'Firebase' || !db || !id || id.startsWith('local_')) return false;
  const { deleteDoc, doc } = window.firebaseApi;
  await deleteDoc(doc(db, collectionName, id));
  return true;
}

function getRoleByCredentials(username, password){
  return authUsers.find(u => u.username === username && u.password === password) || null;
}
function bootSession(role){
  currentRole = role;
  localStorage.setItem(STORAGE_KEYS.role, role);
  loginScreen.classList.add('hidden');
  appRoot.classList.remove('hidden');
  setRoleUI();
  renderAll();
}
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = $('loginUsername').value.trim();
  const password = $('loginPassword').value;
  const found = getRoleByCredentials(username, password);
  if(!found){
    alert('Credenciais inválidas.');
    return;
  }
  await loadData();
  bootSession(found.role);
});
$('logoutBtn').addEventListener('click', () => {
  currentRole = null;
  localStorage.removeItem(STORAGE_KEYS.role);
  loginScreen.classList.remove('hidden');
  appRoot.classList.add('hidden');
  $('loginForm').reset();
});

function renderDashboard(){
  $('statTotalTrabalhos').textContent = trabalhos.length;
  $('statEmAndamento').textContent = trabalhos.filter(t => t.estado === 'Em andamento' || t.estado === 'Pendente').length;
  $('statConcluidos').textContent = trabalhos.filter(t => t.estado === 'Concluído' || t.estado === 'Pago').length;
  $('statTotalFaturado').textContent = euro(trabalhos.reduce((sum, t) => sum + Number(t.valor || 0), 0));

  const recentWrap = $('recentTrabalhos');
  if(!trabalhos.length){
    recentWrap.innerHTML = '<div class="recent-item">Ainda não tens trabalhos registados.</div>';
  } else {
    recentWrap.innerHTML = [...trabalhos].slice(-5).reverse().map(t => `
      <div class="recent-item">
        <div class="mini-label">${escapeHtml(t.estado || 'Sem estado')}</div>
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
  const entries = Object.entries(monthMap).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6);
  const max = Math.max(...entries.map(([,v])=>v), 1);
  $('monthlyBars').innerHTML = entries.length ? entries.map(([month, value]) => `
      <div class="bar-row">
        <span>${month}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(value/max)*100}%"></div></div>
        <strong>${euro(value)}</strong>
      </div>
    `).join('') : '<div class="recent-item">Sem dados mensais ainda.</div>';
}

function actionButtons(type, id){
  if(currentRole !== 'admin') return '<span class="recent-meta">Só leitura</span>';
  return `<div class="row-actions">
    <button class="small-btn" onclick="edit${type}('${id}')">Editar</button>
    <button class="small-btn danger" onclick="delete${type}('${id}')">Apagar</button>
  </div>`;
}

function renderTrabalhos(){
  const term = $('searchTrabalhos').value.trim().toLowerCase();
  const estado = $('filterEstado').value;
  const rows = trabalhos.filter(t => {
    const a = (t.cliente || '').toLowerCase();
    const b = (t.tipoTrabalho || '').toLowerCase();
    return (!term || a.includes(term) || b.includes(term)) && (!estado || t.estado === estado);
  });
  $('trabalhosTableBody').innerHTML = rows.length ? rows.slice().reverse().map(t => `
    <tr>
      <td>${escapeHtml(t.cliente || '-')}</td>
      <td>${escapeHtml(t.tipoTrabalho || '-')}</td>
      <td>${euro(t.valor || 0)}</td>
      <td>${fmtDate(t.dataInicio)}</td>
      <td>${fmtDate(t.dataFim)}</td>
      <td><span class="badge">${escapeHtml(t.estado || '-')}</span></td>
      <td>${actionButtons('Trabalho', t.id)}</td>
    </tr>`).join('') : '<tr><td colspan="7">Sem resultados.</td></tr>';
}

function renderClientes(){
  const term = $('searchClientes').value.trim().toLowerCase();
  const rows = clientes.filter(c => {
    const a = (c.nome || '').toLowerCase();
    const b = (c.telefone || '').toLowerCase();
    return !term || a.includes(term) || b.includes(term);
  });
  $('clientesTableBody').innerHTML = rows.length ? rows.slice().reverse().map(c => `
    <tr>
      <td>${escapeHtml(c.nome || '-')}</td>
      <td>${escapeHtml(c.telefone || '-')}</td>
      <td>${escapeHtml(c.email || '-')}</td>
      <td>${escapeHtml(c.nif || '-')}</td>
      <td>${actionButtons('Cliente', c.id)}</td>
    </tr>`).join('') : '<tr><td colspan="5">Sem clientes registados.</td></tr>';
}

function renderPagamentos(){
  $('pagamentosTableBody').innerHTML = pagamentos.length ? pagamentos.slice().reverse().map(p => `
    <tr>
      <td>${escapeHtml(p.cliente || '-')}</td>
      <td>${escapeHtml(p.referencia || '-')}</td>
      <td>${euro(p.valor || 0)}</td>
      <td>${fmtDate(p.data)}</td>
      <td>${escapeHtml(p.metodo || '-')}</td>
      <td>${actionButtons('Pagamento', p.id)}</td>
    </tr>`).join('') : '<tr><td colspan="6">Sem pagamentos registados.</td></tr>';
}

function renderRelatorios(){
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
  const entries = Object.entries(monthMap).sort((a,b)=>b[0].localeCompare(a[0]));
  $('resumoMensal').innerHTML = entries.length ? entries.map(([month,data]) => `
    <div class="report-card">
      <div class="mini-label">${month}</div>
      <div>Trabalhos</div>
      <strong>${data.trabalhos}</strong>
      <div class="recent-meta">Faturado: ${euro(data.faturado)}</div>
    </div>`).join('') : '<div class="report-card">Sem dados para relatório.</div>';
}

function renderAll(){
  if(!currentRole) return;
  setRoleUI();
  renderDashboard();
  renderTrabalhos();
  renderClientes();
  renderPagamentos();
  renderRelatorios();
}

$('searchTrabalhos').addEventListener('input', renderTrabalhos);
$('filterEstado').addEventListener('change', renderTrabalhos);
$('searchClientes').addEventListener('input', renderClientes);

$('clearTrabalhoBtn').addEventListener('click', ()=>{$('trabalhoForm').reset(); $('trabalhoId').value='';});
$('clearClienteBtn').addEventListener('click', ()=>{$('clienteForm').reset(); $('clienteId').value='';});
$('clearPagamentoBtn').addEventListener('click', ()=>{$('pagamentoForm').reset(); $('pagamentoId').value='';});

function adminGuard(){
  if(currentRole !== 'admin'){
    alert('Só o Admin pode fazer alterações.');
    return false;
  }
  return true;
}

$('trabalhoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if(!adminGuard()) return;
  const item = {
    id: $('trabalhoId').value || ('local_' + uid()),
    cliente: $('cliente').value.trim(),
    contacto: $('contacto').value.trim(),
    tipoTrabalho: $('tipoTrabalho').value.trim(),
    valor: Number($('valor').value || 0),
    dataInicio: $('dataInicio').value,
    dataFim: $('dataFim').value,
    estado: $('estado').value,
    descricao: $('descricao').value.trim()
  };
  if(!item.cliente || !item.tipoTrabalho){ alert('Preenche cliente e tipo de trabalho.'); return; }
  const i = trabalhos.findIndex(x => x.id === item.id);
  if(i >= 0) trabalhos[i] = item; else trabalhos.push(item);
  try { const ok = await persistItem('trabalhos', item); if(!ok) saveLocal(); } catch { saveLocal(); }
  $('trabalhoForm').reset(); $('trabalhoId').value=''; renderAll();
});

$('clienteForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if(!adminGuard()) return;
  const item = {
    id: $('clienteId').value || ('local_' + uid()),
    nome: $('clienteNome').value.trim(),
    telefone: $('clienteTelefone').value.trim(),
    email: $('clienteEmail').value.trim(),
    nif: $('clienteNif').value.trim(),
    morada: $('clienteMorada').value.trim()
  };
  if(!item.nome){ alert('Preenche o nome do cliente.'); return; }
  const i = clientes.findIndex(x => x.id === item.id);
  if(i >= 0) clientes[i] = item; else clientes.push(item);
  try { const ok = await persistItem('clientes', item); if(!ok) saveLocal(); } catch { saveLocal(); }
  $('clienteForm').reset(); $('clienteId').value=''; renderAll();
});

$('pagamentoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if(!adminGuard()) return;
  const item = {
    id: $('pagamentoId').value || ('local_' + uid()),
    cliente: $('pagamentoCliente').value.trim(),
    referencia: $('pagamentoReferencia').value.trim(),
    valor: Number($('pagamentoValor').value || 0),
    data: $('pagamentoData').value,
    metodo: $('pagamentoMetodo').value,
    notas: $('pagamentoNotas').value.trim()
  };
  if(!item.cliente){ alert('Preenche o cliente do pagamento.'); return; }
  const i = pagamentos.findIndex(x => x.id === item.id);
  if(i >= 0) pagamentos[i] = item; else pagamentos.push(item);
  try { const ok = await persistItem('pagamentos', item); if(!ok) saveLocal(); } catch { saveLocal(); }
  $('pagamentoForm').reset(); $('pagamentoId').value=''; renderAll();
});

window.editTrabalho = function(id){
  if(!adminGuard()) return;
  const t = trabalhos.find(x => x.id === id); if(!t) return;
  $('trabalhoId').value=t.id; $('cliente').value=t.cliente||''; $('contacto').value=t.contacto||''; $('tipoTrabalho').value=t.tipoTrabalho||'';
  $('valor').value=t.valor||''; $('dataInicio').value=t.dataInicio||''; $('dataFim').value=t.dataFim||''; $('estado').value=t.estado||'Pendente'; $('descricao').value=t.descricao||'';
  switchTab('trabalhos');
};
window.deleteTrabalho = async function(id){
  if(!adminGuard()) return;
  if(!confirm('Apagar este trabalho?')) return;
  trabalhos = trabalhos.filter(x => x.id !== id);
  try { const ok = await persistDelete('trabalhos', id); if(!ok) saveLocal(); } catch { saveLocal(); }
  renderAll();
};
window.editCliente = function(id){
  if(!adminGuard()) return;
  const c = clientes.find(x => x.id === id); if(!c) return;
  $('clienteId').value=c.id; $('clienteNome').value=c.nome||''; $('clienteTelefone').value=c.telefone||''; $('clienteEmail').value=c.email||''; $('clienteNif').value=c.nif||''; $('clienteMorada').value=c.morada||'';
  switchTab('clientes');
};
window.deleteCliente = async function(id){
  if(!adminGuard()) return;
  if(!confirm('Apagar este cliente?')) return;
  clientes = clientes.filter(x => x.id !== id);
  try { const ok = await persistDelete('clientes', id); if(!ok) saveLocal(); } catch { saveLocal(); }
  renderAll();
};
window.editPagamento = function(id){
  if(!adminGuard()) return;
  const p = pagamentos.find(x => x.id === id); if(!p) return;
  $('pagamentoId').value=p.id; $('pagamentoCliente').value=p.cliente||''; $('pagamentoReferencia').value=p.referencia||''; $('pagamentoValor').value=p.valor||''; $('pagamentoData').value=p.data||''; $('pagamentoMetodo').value=p.metodo||'Dinheiro'; $('pagamentoNotas').value=p.notas||'';
  switchTab('pagamentos');
};
window.deletePagamento = async function(id){
  if(!adminGuard()) return;
  if(!confirm('Apagar este pagamento?')) return;
  pagamentos = pagamentos.filter(x => x.id !== id);
  try { const ok = await persistDelete('pagamentos', id); if(!ok) saveLocal(); } catch { saveLocal(); }
  renderAll();
};

function exportBackup(){
  const payload = { exportadoEm:new Date().toISOString(), appVersion:APP_VERSION, dataMode, currentRole, trabalhos, clientes, pagamentos };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'gestao-empresa-backup.json'; a.click(); URL.revokeObjectURL(a.href);
}
$('exportBackupBtn').addEventListener('click', exportBackup);
$('syncBtn').addEventListener('click', async () => { await loadData(); renderAll(); alert(dataMode === 'Firebase' ? 'Firebase ligado com sucesso.' : 'Ainda está em modo local. Confirma o ficheiro js/firebase-config.js.'); });

async function checkForUpdates(){
  try{
    const res = await fetch(`./version.json?v=${Date.now()}`, { cache:'no-store' });
    if(!res.ok) return;
    const data = await res.json();
    $('versionBadge').textContent = data.version || APP_VERSION;

    const lastSeen = localStorage.getItem(VERSION_KEY);
    if(lastSeen && data.version && data.version !== lastSeen){
      $('updateBanner').classList.remove('hidden');
    }
    if(data.version){
      localStorage.setItem(VERSION_KEY, data.version);
    }
  }catch(err){
    console.log('Sem verificação de update:', err);
  }
}
$('reloadAppBtn').addEventListener('click', () => window.location.reload(true));

(async function init(){
  await checkForUpdates();
  setInterval(checkForUpdates, 60000);

  const savedRole = localStorage.getItem(STORAGE_KEYS.role);
  if(savedRole === 'admin' || savedRole === 'user'){
    currentRole = savedRole;
    await loadData();
    loginScreen.classList.add('hidden');
    appRoot.classList.remove('hidden');
    setRoleUI();
    renderAll();
  }
})();
