
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const APP_VERSION = '1.0.6';
const STORAGE_KEYS = { trabalhos:'ge_trabalhos', clientes:'ge_clientes', pagamentos:'ge_pagamentos' };
const USERS = [
  { username: 'Ricardo', password: '2297', role: 'master_admin', permissions: ['all','users','billing','clients_history'] },
  { username: 'admin', password: 'admin123', role: 'admin', permissions: ['manage','billing','clients_history'] },
  { username: 'user', password: 'user123', role: 'user', permissions: ['read'] }
];

let currentRole = null, currentUsername = null;
let pendingPaymentWorkId = null;
let trabalhos = [], clientes = [], pagamentos = [];

let firebaseApp = null;
let firebaseAuth = null;
let firestoreDb = null;
let syncReady = false;
let syncMessage = 'Local';
let unsubs = [];

const $ = (id) => document.getElementById(id);
const navButtons = document.querySelectorAll('.nav-btn');
const bottomButtons = document.querySelectorAll('.bottom-btn');
const pages = document.querySelectorAll('.page');

const euro = (v) => Number(v || 0).toLocaleString('pt-PT', {style:'currency', currency:'EUR'});
const fmtDate = (v) => { if(!v) return '-'; const d = new Date(v); return isNaN(d) ? '-' : d.toLocaleDateString('pt-PT'); };
const escapeHtml = (s='') => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const isMasterAdmin = () => currentRole === 'master_admin';
const isAdminLike = () => currentRole === 'admin' || currentRole === 'master_admin';

function genId(prefix='id'){
  if (window.crypto?.randomUUID) return `${prefix}_${window.crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
}

function loadLocal(){
  try{trabalhos=JSON.parse(localStorage.getItem(STORAGE_KEYS.trabalhos))||[]}catch{trabalhos=[]}
  try{clientes=JSON.parse(localStorage.getItem(STORAGE_KEYS.clientes))||[]}catch{clientes=[]}
  try{pagamentos=JSON.parse(localStorage.getItem(STORAGE_KEYS.pagamentos))||[]}catch{pagamentos=[]}
}
function saveLocal(){
  localStorage.setItem(STORAGE_KEYS.trabalhos, JSON.stringify(trabalhos));
  localStorage.setItem(STORAGE_KEYS.clientes, JSON.stringify(clientes));
  localStorage.setItem(STORAGE_KEYS.pagamentos, JSON.stringify(pagamentos));
  autoBackupInvisible();
}
function autoBackupInvisible(){
  const payload = {
    exportadoEm: new Date().toISOString(),
    appVersion: APP_VERSION,
    currentUsername,
    currentRole,
    trabalhos,
    clientes,
    pagamentos
  };
  localStorage.setItem('ge_invisible_backup', JSON.stringify(payload));
}
function setSyncMessage(msg, level='warn'){
  syncMessage = msg;
  const mode = $('modeLine');
  if (mode) {
    mode.textContent = `Modo: ${msg}`;
    mode.classList.remove('sync-ok','sync-warn','sync-bad');
    mode.classList.add(level === 'ok' ? 'sync-ok' : (level === 'bad' ? 'sync-bad' : 'sync-warn'));
  }
  const note = $('syncLoginNote');
  if (note) {
    note.innerHTML = `<strong>Sync:</strong> ${msg}`;
    note.classList.remove('sync-ok','sync-warn','sync-bad');
    note.classList.add(level === 'ok' ? 'sync-ok' : (level === 'bad' ? 'sync-bad' : 'sync-warn'));
  }
}
function setRoleUI(){
  if(!currentRole) return;
  const roleLabel = currentRole === 'master_admin' ? 'Admin Mestre' : (currentRole === 'admin' ? 'Admin' : 'User');
  document.body.classList.toggle('role-view-user', currentRole === 'user');
  document.body.classList.toggle('role-view-admin', currentRole === 'admin');
  $('roleBadge').textContent = roleLabel;
  $('roleLine').textContent = `Role: ${roleLabel}`;
  $('versionBadge').textContent = APP_VERSION;
  $('currentUserName').textContent = currentUsername || 'Utilizador';
  const usersSection = $('usersSection');
  if(usersSection) usersSection.style.display = isMasterAdmin() ? 'block' : 'none';
  setSyncMessage(syncReady ? 'Firebase Sync' : syncMessage, syncReady ? 'ok' : 'warn');
}
function switchTab(tab){
  navButtons.forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  bottomButtons.forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  pages.forEach(p => p.classList.toggle('active', p.id===`${tab}-page`));
  const btn=document.querySelector(`.nav-btn[data-tab="${tab}"]`);
  $('pageTitle').textContent = btn ? btn.textContent.trim() : 'Dashboard';
  window.scrollTo({top:0,behavior:'smooth'});
}
navButtons.forEach(b => b.addEventListener('click', ()=>switchTab(b.dataset.tab)));
bottomButtons.forEach(b => b.addEventListener('click', ()=>switchTab(b.dataset.tab)));
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', ()=>switchTab(b.dataset.go)));

async function initFirebaseSync(){
  try{
    firebaseApp = initializeApp(firebaseConfig);
    firebaseAuth = getAuth(firebaseApp);
    firestoreDb = getFirestore(firebaseApp);
    setSyncMessage('A ligar ao Firebase…', 'warn');

    await signInAnonymously(firebaseAuth);
    onAuthStateChanged(firebaseAuth, user => {
      if (user) {
        syncReady = true;
        setSyncMessage('Firebase Sync', 'ok');
        attachRealtimeListeners();
      } else {
        syncReady = false;
        setSyncMessage('Sem sessão Firebase', 'bad');
      }
      if (currentRole) renderAll();
    });
  }catch(err){
    console.error('Firebase sync error:', err);
    syncReady = false;
    const msg = err?.code === 'auth/operation-not-allowed'
      ? 'Ativa Anonymous Auth no Firebase'
      : 'Local (Firebase indisponível)';
    setSyncMessage(msg, 'bad');
  }
}

function clearRealtimeListeners(){
  unsubs.forEach(fn => { try{ fn(); }catch{} });
  unsubs = [];
}
function attachRealtimeListeners(){
  if (!firestoreDb || unsubs.length) return;
  const bind = (name, setter) => {
    const unsub = onSnapshot(collection(firestoreDb, name), snap => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setter(rows);
      saveLocal();
      if (currentRole) renderAll();
    }, err => {
      console.error(`Snapshot ${name} failed:`, err);
      setSyncMessage('Erro de sync, uso local', 'bad');
    });
    unsubs.push(unsub);
  };
  bind('trabalhos', rows => { trabalhos = rows; });
  bind('clientes', rows => { clientes = rows; });
  bind('pagamentos', rows => { pagamentos = rows; });
}
async function upsertRemote(collectionName, item){
  if (!syncReady || !firestoreDb) return false;
  await setDoc(doc(firestoreDb, collectionName, item.id), item, { merge: true });
  return true;
}
async function removeRemote(collectionName, id){
  if (!syncReady || !firestoreDb || !id) return false;
  await deleteDoc(doc(firestoreDb, collectionName, id));
  return true;
}

$('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const username = $('loginUsername').value.trim().toLowerCase();
  const password = $('loginPassword').value;
  const found = USERS.find(u => u.username.toLowerCase() === username && u.password === password);

  if(!found){
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

$('logoutBtn').addEventListener('click', () => {
  currentRole = null;
  currentUsername = null;
  $('loginScreen').classList.remove('hidden');
  $('appRoot').classList.add('hidden');
  $('loginForm').reset();
});

function adminGuard(){ if(!isAdminLike()){ alert('Só o Admin pode fazer alterações.'); return false; } return true; }
function printHtml(title, bodyHtml){ const win=window.open('', '_blank'); if(!win) return; win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}h1,h2{margin:0 0 10px}.meta{color:#555;margin-bottom:20px}.card{border:1px solid #ddd;border-radius:12px;padding:18px;margin:12px 0}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border-bottom:1px solid #ddd;padding:10px;text-align:left}</style></head><body>${bodyHtml}</body></html>`); win.document.close(); setTimeout(()=>{ win.focus(); win.print(); },300); }

function renderDashboard(){
  $('statTotalTrabalhos').textContent=trabalhos.length;
  $('statEmAndamento').textContent=trabalhos.filter(t=>t.estado==='Em andamento'||t.estado==='Pendente').length;
  $('statConcluidos').textContent=trabalhos.filter(t=>t.estado==='Concluído'||t.estado==='Pago').length;
  $('statTotalFaturado').textContent=euro(trabalhos.reduce((s,t)=>s+Number(t.valor||0),0));
  const recentWrap=$('recentTrabalhos');
  recentWrap.innerHTML = !trabalhos.length ? '<div class="recent-item">Ainda não tens trabalhos registados.</div>' : [...trabalhos].slice(-5).reverse().map(t=>`<div class="recent-item"><div class="mini-label">${escapeHtml(t.estado||'Sem estado')}</div><strong>${escapeHtml(t.cliente||'-')}</strong><div>${escapeHtml(t.tipoTrabalho||'-')}</div><div class="recent-meta">${euro(t.valor||0)} • ${fmtDate(t.dataInicio)} → ${fmtDate(t.dataFim)}</div></div>`).join('');
  const monthMap={};
  trabalhos.forEach(t=>{ if(!t.dataInicio) return; const d=new Date(t.dataInicio); if(isNaN(d)) return; const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; monthMap[key]=(monthMap[key]||0)+Number(t.valor||0);});
  const entries=Object.entries(monthMap).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6);
  const max=Math.max(...entries.map(([,v])=>v),1);
  $('monthlyBars').innerHTML = entries.length ? entries.map(([m,v])=>`<div class="bar-row"><span>${m}</span><div class="bar-track"><div class="bar-fill" style="width:${(v/max)*100}%"></div></div><strong>${euro(v)}</strong></div>`).join('') : '<div class="recent-item">Sem dados mensais ainda.</div>';
}
function renderAlerts(){
  const pend=trabalhos.filter(t=>t.estado==='Pendente').length;
  const andam=trabalhos.filter(t=>t.estado==='Em andamento').length;
  const semFim=trabalhos.filter(t=>!t.dataFim).length;
  $('alertCards').innerHTML = `<div class="alert-card"><span class="mini-label">Pendentes</span><strong>${pend}</strong><p>Trabalhos ainda por arrancar ou fechar.</p></div><div class="alert-card"><span class="mini-label">Em andamento</span><strong>${andam}</strong><p>Serviços que precisam de acompanhamento.</p></div><div class="alert-card"><span class="mini-label">Sem data fim</span><strong>${semFim}</strong><p>Registos que convém completar.</p></div>`;
}
function trabalhoActions(t){
  return `
    <div class="row-actions">
      <button class="btn-action primary" onclick="generateInvoice('${t.id}')">Fatura</button>
      <button class="btn-action" onclick="pdfTrabalho('${t.id}')">PDF</button>
      <button class="btn-action" onclick="editTrabalho('${t.id}')">Editar</button>
      <button class="btn-action success" onclick="openMarkPaidModal('${t.id}')">Pago ✔</button>
      <button class="btn-action danger" onclick="deleteTrabalho('${t.id}')">🗑</button>
    </div>
  `;
}
function clienteActions(c){
  const history=`<button class="small-btn" onclick="openClientHistory('${c.id}')">Histórico</button>`;
  const pdf=`<button class="small-btn" onclick="pdfCliente('${c.id}')">PDF</button>`;
  return !isAdminLike() ? `${history}${pdf}` : `${history}${pdf}<button class="small-btn" onclick="editCliente('${c.id}')">Editar</button><button class="small-btn danger" onclick="deleteCliente('${c.id}')">Apagar</button>`;
}
function pagamentoActions(p){
  const pdf=`<button class="small-btn" onclick="pdfPagamento('${p.id}')">PDF</button>`;
  return !isAdminLike() ? pdf : `${pdf}<button class="small-btn" onclick="editPagamento('${p.id}')">Editar</button><button class="small-btn danger" onclick="deletePagamento('${p.id}')">Apagar</button>`;
}
function renderTrabalhos(){
  const term=$('searchTrabalhos').value.trim().toLowerCase();
  const globalTerm=($('globalSearch')?.value||'').trim().toLowerCase();
  const estado=$('filterEstado').value;
  const rows=trabalhos.filter(t=>{
    const hay=[t.cliente,t.tipoTrabalho,t.contacto,t.descricao,t.estado].join(' ').toLowerCase();
    return (!term||hay.includes(term))&&(!globalTerm||hay.includes(globalTerm))&&(!estado||t.estado===estado)
  });
  $('trabalhosTableBody').innerHTML = rows.length ? rows.slice().reverse().map(t=>`<tr><td>${escapeHtml(t.cliente||'-')}</td><td>${escapeHtml(t.tipoTrabalho||'-')}</td><td>${euro(t.valor||0)}</td><td>${fmtDate(t.dataInicio)}</td><td>${fmtDate(t.dataFim)}</td><td><span class="badge" data-state="${escapeHtml(t.estado||'-')}">${escapeHtml(t.estado||'-')}</span></td><td><div class="row-actions">${trabalhoActions(t)}</div></td></tr>`).join('') : '<tr><td colspan="7">Sem resultados.</td></tr>';
}
function renderClientes(){
  const term=$('searchClientes').value.trim().toLowerCase();
  const globalTerm=($('globalSearch')?.value||'').trim().toLowerCase();
  const rows=clientes.filter(c=>{
    const hay=[c.nome,c.telefone,c.email,c.nif,c.morada].join(' ').toLowerCase();
    return (!term||hay.includes(term))&&(!globalTerm||hay.includes(globalTerm))
  });
  $('clientesTableBody').innerHTML = rows.length ? rows.slice().reverse().map(c=>`<tr><td>${escapeHtml(c.nome||'-')}</td><td>${escapeHtml(c.telefone||'-')}</td><td>${escapeHtml(c.email||'-')}</td><td>${escapeHtml(c.nif||'-')}</td><td><div class="row-actions">${clienteActions(c)}</div></td></tr>`).join('') : '<tr><td colspan="5">Sem clientes registados.</td></tr>';
}
function renderPagamentos(){
  const globalTerm=($('globalSearch')?.value||'').trim().toLowerCase();
  const rows=pagamentos.filter(p=>{
    const hay=[p.cliente,p.referencia,p.metodo,p.notas].join(' ').toLowerCase();
    return !globalTerm || hay.includes(globalTerm)
  });
  $('pagamentosTableBody').innerHTML = rows.length ? rows.slice().reverse().map(p=>`<tr><td>${escapeHtml(p.cliente||'-')}</td><td>${escapeHtml(p.referencia||'-')}</td><td>${euro(p.valor||0)}</td><td>${fmtDate(p.data)}</td><td>${escapeHtml(p.metodo||'-')}</td><td><div class="row-actions">${pagamentoActions(p)}</div></td></tr>`).join('') : '<tr><td colspan="6">Sem pagamentos registados.</td></tr>';
}
function renderRelatorios(){
  const monthMap={};
  trabalhos.forEach(t=>{const source=t.dataInicio||t.dataFim; if(!source) return; const d=new Date(source); if(isNaN(d)) return; const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; monthMap[key]=monthMap[key]||{trabalhos:0,faturado:0}; monthMap[key].trabalhos+=1; monthMap[key].faturado+=Number(t.valor||0);});
  const entries=Object.entries(monthMap).sort((a,b)=>b[0].localeCompare(a[0]));
  $('resumoMensal').innerHTML = entries.length ? entries.map(([m,d])=>`<div class="report-card"><div class="mini-label">${m}</div><div>Trabalhos</div><strong>${d.trabalhos}</strong><div class="recent-meta">Faturado: ${euro(d.faturado)}</div></div>`).join('') : '<div class="report-card">Sem dados para relatório.</div>';
}
function renderAll(){ if(!currentRole) return; setRoleUI(); renderDashboard(); renderAlerts(); renderTrabalhos(); renderClientes(); renderPagamentos(); renderRelatorios(); }

$('searchTrabalhos').addEventListener('input', renderTrabalhos);
$('filterEstado').addEventListener('change', renderTrabalhos);
$('searchClientes').addEventListener('input', renderClientes);
$('globalSearch').addEventListener('input', ()=>{ renderTrabalhos(); renderClientes(); renderPagamentos(); });

$('clearTrabalhoBtn').addEventListener('click', ()=>{$('trabalhoForm').reset();$('trabalhoId').value='';});
$('clearClienteBtn').addEventListener('click', ()=>{$('clienteForm').reset();$('clienteId').value='';});
$('clearPagamentoBtn').addEventListener('click', ()=>{$('pagamentoForm').reset();$('pagamentoId').value='';});

$('trabalhoForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!adminGuard()) return;
  const item={
    id:$('trabalhoId').value || genId('trab'),
    cliente:$('cliente').value.trim(),
    contacto:$('contacto').value.trim(),
    tipoTrabalho:$('tipoTrabalho').value.trim(),
    valor:Number($('valor').value||0),
    dataInicio:$('dataInicio').value,
    dataFim:$('dataFim').value,
    estado:$('estado').value,
    descricao:$('descricao').value.trim()
  };
  if(!item.cliente||!item.tipoTrabalho){alert('Preenche cliente e tipo de trabalho.');return;}
  const i=trabalhos.findIndex(x=>x.id===item.id);
  if(i>=0) trabalhos[i]=item; else trabalhos.push(item);
  saveLocal();
  renderAll();
  try{ await upsertRemote('trabalhos', item); }catch(err){ console.error(err); setSyncMessage('Erro a gravar no Firebase', 'bad'); }
  $('trabalhoForm').reset(); $('trabalhoId').value='';
});

$('clienteForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!adminGuard()) return;
  const item={
    id:$('clienteId').value || genId('cli'),
    nome:$('clienteNome').value.trim(),
    telefone:$('clienteTelefone').value.trim(),
    email:$('clienteEmail').value.trim(),
    nif:$('clienteNif').value.trim(),
    morada:$('clienteMorada').value.trim()
  };
  if(!item.nome){alert('Preenche o nome do cliente.');return;}
  const i=clientes.findIndex(x=>x.id===item.id);
  if(i>=0) clientes[i]=item; else clientes.push(item);
  saveLocal();
  renderAll();
  try{ await upsertRemote('clientes', item); }catch(err){ console.error(err); setSyncMessage('Erro a gravar no Firebase', 'bad'); }
  $('clienteForm').reset(); $('clienteId').value='';
});

$('pagamentoForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!adminGuard()) return;
  const item={
    id:$('pagamentoId').value || genId('pag'),
    cliente:$('pagamentoCliente').value.trim(),
    referencia:$('pagamentoReferencia').value.trim(),
    valor:Number($('pagamentoValor').value||0),
    data:$('pagamentoData').value,
    metodo:$('pagamentoMetodo').value,
    notas:$('pagamentoNotas').value.trim()
  };
  if(!item.cliente){alert('Preenche o cliente do pagamento.');return;}
  const i=pagamentos.findIndex(x=>x.id===item.id);
  if(i>=0) pagamentos[i]=item; else pagamentos.push(item);
  saveLocal();
  renderAll();
  try{ await upsertRemote('pagamentos', item); }catch(err){ console.error(err); setSyncMessage('Erro a gravar no Firebase', 'bad'); }
  $('pagamentoForm').reset(); $('pagamentoId').value='';
});

window.editTrabalho = function(id){
  if(!adminGuard()) return;
  const t=trabalhos.find(x=>x.id===id); if(!t) return;
  $('trabalhoId').value=t.id; $('cliente').value=t.cliente||''; $('contacto').value=t.contacto||''; $('tipoTrabalho').value=t.tipoTrabalho||'';
  $('valor').value=t.valor||''; $('dataInicio').value=t.dataInicio||''; $('dataFim').value=t.dataFim||''; $('estado').value=t.estado||'Pendente'; $('descricao').value=t.descricao||'';
  switchTab('trabalhos');
};
window.deleteTrabalho = async function(id){
  if(!adminGuard()) return;
  if(!confirm('Apagar este trabalho?')) return;
  trabalhos=trabalhos.filter(x=>x.id!==id);
  saveLocal(); renderAll();
  try{ await removeRemote('trabalhos', id); }catch(err){ console.error(err); setSyncMessage('Erro a apagar no Firebase', 'bad'); }
};
window.editCliente = function(id){
  if(!adminGuard()) return;
  const c=clientes.find(x=>x.id===id); if(!c) return;
  $('clienteId').value=c.id; $('clienteNome').value=c.nome||''; $('clienteTelefone').value=c.telefone||''; $('clienteEmail').value=c.email||''; $('clienteNif').value=c.nif||''; $('clienteMorada').value=c.morada||'';
  switchTab('clientes');
};
window.deleteCliente = async function(id){
  if(!adminGuard()) return;
  if(!confirm('Apagar este cliente?')) return;
  clientes=clientes.filter(x=>x.id!==id);
  saveLocal(); renderAll();
  try{ await removeRemote('clientes', id); }catch(err){ console.error(err); setSyncMessage('Erro a apagar no Firebase', 'bad'); }
};
window.editPagamento = function(id){
  if(!adminGuard()) return;
  const p=pagamentos.find(x=>x.id===id); if(!p) return;
  $('pagamentoId').value=p.id; $('pagamentoCliente').value=p.cliente||''; $('pagamentoReferencia').value=p.referencia||''; $('pagamentoValor').value=p.valor||''; $('pagamentoData').value=p.data||''; $('pagamentoMetodo').value=p.metodo||'Dinheiro'; $('pagamentoNotas').value=p.notas||'';
  switchTab('pagamentos');
};
window.deletePagamento = async function(id){
  if(!adminGuard()) return;
  if(!confirm('Apagar este pagamento?')) return;
  pagamentos=pagamentos.filter(x=>x.id!==id);
  saveLocal(); renderAll();
  try{ await removeRemote('pagamentos', id); }catch(err){ console.error(err); setSyncMessage('Erro a apagar no Firebase', 'bad'); }
};

const clientModal = $('clientModal');
$('closeClientModal').addEventListener('click', ()=> clientModal.classList.add('hidden'));
clientModal.addEventListener('click', (e)=>{ if(e.target === clientModal) clientModal.classList.add('hidden'); });

window.openClientHistory = function(id){
  const c = clientes.find(x=>x.id===id);
  if(!c) return;
  const relatedTrabalhos = trabalhos.filter(t => (t.cliente||'').trim().toLowerCase() === (c.nome||'').trim().toLowerCase());
  const relatedPagamentos = pagamentos.filter(p => (p.cliente||'').trim().toLowerCase() === (c.nome||'').trim().toLowerCase());
  const totalTrabalhos = relatedTrabalhos.reduce((s,t)=>s+Number(t.valor||0),0);
  const totalPagamentos = relatedPagamentos.reduce((s,p)=>s+Number(p.valor||0),0);

  $('clientModalTitle').textContent = `Histórico de ${c.nome || 'Cliente'}`;
  $('clientModalContent').innerHTML = `
    <div class="client-summary-grid">
      <div class="client-summary-card"><span>Total trabalhos</span><strong>${relatedTrabalhos.length}</strong></div>
      <div class="client-summary-card"><span>Total faturado</span><strong>${euro(totalTrabalhos)}</strong></div>
      <div class="client-summary-card"><span>Total pago</span><strong>${euro(totalPagamentos)}</strong></div>
      <div class="client-summary-card"><span>Estado</span><strong>${relatedPagamentos.length ? 'Com histórico' : 'Sem pagamentos'}</strong></div>
    </div>
    <section class="panel">
      <div class="panel-head"><h3>Dados do cliente</h3><span class="autobackup-badge">Histórico ativo</span></div>
      <div class="table-wrap">
        <table>
          <tbody>
            <tr><td><strong>Nome</strong></td><td>${escapeHtml(c.nome||'-')}</td></tr>
            <tr><td><strong>Telefone</strong></td><td>${escapeHtml(c.telefone||'-')}</td></tr>
            <tr><td><strong>Email</strong></td><td>${escapeHtml(c.email||'-')}</td></tr>
            <tr><td><strong>NIF</strong></td><td>${escapeHtml(c.nif||'-')}</td></tr>
            <tr><td><strong>Morada</strong></td><td>${escapeHtml(c.morada||'-')}</td></tr>
          </tbody>
        </table>
      </div>
    </section>
    <section class="panel">
      <div class="panel-head"><h3>Trabalhos do cliente</h3></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tipo</th><th>Valor</th><th>Início</th><th>Fim</th><th>Estado</th></tr></thead>
          <tbody>
            ${relatedTrabalhos.length ? relatedTrabalhos.slice().reverse().map(t=>`<tr><td>${escapeHtml(t.tipoTrabalho||'-')}</td><td>${euro(t.valor||0)}</td><td>${fmtDate(t.dataInicio)}</td><td>${fmtDate(t.dataFim)}</td><td><span class="badge" data-state="${escapeHtml(t.estado||'-')}">${escapeHtml(t.estado||'-')}</span></td></tr>`).join('') : '<tr><td colspan="5">Sem trabalhos registados.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
    <section class="panel">
      <div class="panel-head"><h3>Pagamentos do cliente</h3></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Referência</th><th>Valor</th><th>Data</th><th>Método</th></tr></thead>
          <tbody>
            ${relatedPagamentos.length ? relatedPagamentos.slice().reverse().map(p=>`<tr><td>${escapeHtml(p.referencia||'-')}</td><td>${euro(p.valor||0)}</td><td>${fmtDate(p.data)}</td><td>${escapeHtml(p.metodo||'-')}</td></tr>`).join('') : '<tr><td colspan="4">Sem pagamentos registados.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
  clientModal.classList.remove('hidden');
};

window.generateInvoice = function(id){
  const t = trabalhos.find(x=>x.id===id);
  if(!t) return;
  const invoiceNumber = `FT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  printHtml(`Fatura ${invoiceNumber}`, `
    <h1>Fatura / Serviço</h1>
    <div class="meta">Nº ${invoiceNumber}</div>
    <div class="card"><strong>Cliente:</strong> ${escapeHtml(t.cliente||'-')}</div>
    <div class="card"><strong>Tipo de trabalho:</strong> ${escapeHtml(t.tipoTrabalho||'-')}</div>
    <div class="card"><strong>Contacto:</strong> ${escapeHtml(t.contacto||'-')}</div>
    <div class="card"><strong>Data de início:</strong> ${fmtDate(t.dataInicio)}<br><strong>Data de fim:</strong> ${fmtDate(t.dataFim)}</div>
    <div class="card"><strong>Estado:</strong> ${escapeHtml(t.estado||'-')}</div>
    <div class="card"><strong>Descrição:</strong><br>${escapeHtml(t.descricao||'-')}</div>
    <div class="card"><strong>Total:</strong> ${euro(t.valor||0)}</div>
  `);
};


const paymentModal = $('paymentConfirmModal');
$('closePaymentModal')?.addEventListener('click', ()=> { pendingPaymentWorkId = null; paymentModal?.classList.add('hidden'); });
$('cancelMarkPaidBtn')?.addEventListener('click', ()=> { pendingPaymentWorkId = null; paymentModal?.classList.add('hidden'); });
paymentModal?.addEventListener('click', (e)=>{ if(e.target === paymentModal){ pendingPaymentWorkId = null; paymentModal.classList.add('hidden'); } });

window.openMarkPaidModal = function(id){
  const t = trabalhos.find(x => x.id === id);
  if(!t || !paymentModal) return;
  pendingPaymentWorkId = id;
  $('paymentModalJobTitle').textContent = t.tipoTrabalho || 'Trabalho';
  $('paymentModalJobClient').textContent = `${t.cliente || '-'} • ${euro(t.valor || 0)}`;
  $('paymentMethodSelect').value = 'Dinheiro';
  $('paymentInvoiceTypeSelect').value = 'Com Fatura';
  $('paymentMethodNotes').value = '';
  paymentModal.classList.remove('hidden');
};

function markAsPaidConfirmed(){
  if(!pendingPaymentWorkId) return;
  const t = trabalhos.find(x => x.id === pendingPaymentWorkId);
  if(!t) return;

  const metodo = $('paymentMethodSelect').value || 'Dinheiro';
  const tipoFatura = $('paymentInvoiceTypeSelect').value || 'Com Fatura';
  const notasExtra = $('paymentMethodNotes').value.trim();

  t.estado = 'Pago';
  if(!t.dataFim){
    const hoje = new Date();
    t.dataFim = hoje.toISOString().split('T')[0];
  }

  const notas = [tipoFatura, notasExtra || 'Pagamento registado manualmente'].join(' • ');

  pagamentos.push({
    id: 'local_' + Date.now().toString(36),
    cliente: t.cliente || '',
    referencia: t.tipoTrabalho || '',
    valor: Number(t.valor || 0),
    data: new Date().toISOString().split('T')[0],
    metodo,
    notas
  });

  saveLocal();
  renderAll();
  pendingPaymentWorkId = null;
  paymentModal?.classList.add('hidden');
}

$('confirmMarkPaidBtn')?.addEventListener('click', markAsPaidConfirmed);

window.pdfTrabalho = function(id){ const t=trabalhos.find(x=>x.id===id); if(!t) return; printHtml(`Trabalho ${t.cliente}`, `<h1>Ficha de Trabalho</h1><div class='meta'>${escapeHtml(t.cliente||'-')} • ${escapeHtml(t.tipoTrabalho||'-')}</div><div class='card'><strong>Cliente:</strong> ${escapeHtml(t.cliente||'-')}</div><div class='card'><strong>Contacto:</strong> ${escapeHtml(t.contacto||'-')}</div><div class='card'><strong>Tipo de trabalho:</strong> ${escapeHtml(t.tipoTrabalho||'-')}</div><div class='card'><strong>Valor:</strong> ${euro(t.valor||0)}</div><div class='card'><strong>Início:</strong> ${fmtDate(t.dataInicio)}<br><strong>Fim:</strong> ${fmtDate(t.dataFim)}</div><div class='card'><strong>Estado:</strong> ${escapeHtml(t.estado||'-')}</div><div class='card'><strong>Descrição:</strong><br>${escapeHtml(t.descricao||'-')}</div>`); };
window.pdfCliente = function(id){ const c=clientes.find(x=>x.id===id); if(!c) return; const trabalhosCliente=trabalhos.filter(t=>(t.cliente||'').trim().toLowerCase()===(c.nome||'').trim().toLowerCase()); const linhas=trabalhosCliente.map(t=>`<tr><td>${escapeHtml(t.tipoTrabalho||'-')}</td><td>${fmtDate(t.dataInicio)}</td><td>${euro(t.valor||0)}</td></tr>`).join(''); printHtml(`Cliente ${c.nome}`, `<h1>Ficha de Cliente</h1><div class='meta'>${escapeHtml(c.nome||'-')}</div><div class='card'><strong>Telefone:</strong> ${escapeHtml(c.telefone||'-')}</div><div class='card'><strong>Email:</strong> ${escapeHtml(c.email||'-')}</div><div class='card'><strong>NIF:</strong> ${escapeHtml(c.nif||'-')}</div><div class='card'><strong>Morada:</strong><br>${escapeHtml(c.morada||'-')}</div><h2>Trabalhos associados</h2><table><thead><tr><th>Tipo</th><th>Data</th><th>Valor</th></tr></thead><tbody>${linhas || '<tr><td colspan="3">Sem trabalhos associados</td></tr>'}</tbody></table>`); };
window.pdfPagamento = function(id){ const p=pagamentos.find(x=>x.id===id); if(!p) return; printHtml(`Pagamento ${p.cliente}`, `<h1>Comprovativo de Pagamento</h1><div class='meta'>${escapeHtml(p.cliente||'-')}</div><div class='card'><strong>Cliente:</strong> ${escapeHtml(p.cliente||'-')}</div><div class='card'><strong>Referência:</strong> ${escapeHtml(p.referencia||'-')}</div><div class='card'><strong>Valor:</strong> ${euro(p.valor||0)}</div><div class='card'><strong>Data:</strong> ${fmtDate(p.data)}</div><div class='card'><strong>Método:</strong> ${escapeHtml(p.metodo||'-')}</div><div class='card'><strong>Notas:</strong><br>${escapeHtml(p.notas||'-')}</div>`); };

function exportBackup(){ const payload={ exportadoEm:new Date().toISOString(), appVersion:APP_VERSION, currentUsername, currentRole, trabalhos, clientes, pagamentos }; const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='gestao-empresa-backup.json'; a.click(); URL.revokeObjectURL(a.href); }
$('exportBackupBtn').addEventListener('click', exportBackup);
$('exportMonthlyPdfBtn').addEventListener('click', ()=>{ const html=$('resumoMensal').innerHTML; printHtml('Relatório mensal', `<h1>Relatório Mensal</h1><div style="display:grid;gap:14px">${html}</div>`); });

loadLocal();
autoBackupInvisible();
initFirebaseSync();
