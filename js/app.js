import { firebaseConfig } from './firebase-config.js';

const APP_VERSION = '3.0.0';
const VERSION_KEY = 'ge_app_version_seen';
const STORAGE_KEYS = { trabalhos:'ge_trabalhos', clientes:'ge_clientes', pagamentos:'ge_pagamentos' };

let firebaseReady = false, db = null, auth = null, googleProvider = null, dataMode = 'Local';
let currentRole = null, currentUsername = null, currentUser = null;
let trabalhos = [], clientes = [], pagamentos = [];

const $ = (id) => document.getElementById(id);
const navButtons = document.querySelectorAll('.nav-btn');
const bottomButtons = document.querySelectorAll('.bottom-btn');
const pages = document.querySelectorAll('.page');

const euro = (v) => Number(v || 0).toLocaleString('pt-PT', {style:'currency', currency:'EUR'});
const fmtDate = (v) => { if(!v) return '-'; const d = new Date(v); return isNaN(d) ? '-' : d.toLocaleDateString('pt-PT'); };
const escapeHtml = (s='') => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const isMasterAdmin = () => currentRole === 'master_admin';
const isAdminLike = () => currentRole === 'admin' || currentRole === 'master_admin';

function loadLocal(){ try{trabalhos=JSON.parse(localStorage.getItem(STORAGE_KEYS.trabalhos))||[]}catch{trabalhos=[]}
 try{clientes=JSON.parse(localStorage.getItem(STORAGE_KEYS.clientes))||[]}catch{clientes=[]}
 try{pagamentos=JSON.parse(localStorage.getItem(STORAGE_KEYS.pagamentos))||[]}catch{pagamentos=[]}}
function saveLocal(){ localStorage.setItem(STORAGE_KEYS.trabalhos, JSON.stringify(trabalhos)); localStorage.setItem(STORAGE_KEYS.clientes, JSON.stringify(clientes)); localStorage.setItem(STORAGE_KEYS.pagamentos, JSON.stringify(pagamentos)); }

async function initFirebase(){
  if(!firebaseConfig){ dataMode='Local'; firebaseReady=false; return false; }
  try{
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const { getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    const { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app); db = getFirestore(app); googleProvider = new GoogleAuthProvider();
    window.firebaseApi = { signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc };
    firebaseReady = true; dataMode = 'Firebase'; return true;
  }catch(err){ console.error(err); firebaseReady=false; dataMode='Local'; return false; }
}
async function fetchCollection(name){ const { collection, getDocs } = window.firebaseApi; const snap = await getDocs(collection(db,name)); return snap.docs.map(d => ({ id:d.id, ...d.data() })); }
async function loadData(){ if(firebaseReady){ try{ trabalhos=await fetchCollection('trabalhos'); clientes=await fetchCollection('clientes'); pagamentos=await fetchCollection('pagamentos'); saveLocal(); return; }catch(e){ console.error(e);} } loadLocal(); }
async function persistItem(collectionName, item){ if(!firebaseReady || !db){ saveLocal(); return false; } const { collection, addDoc, updateDoc, doc } = window.firebaseApi; if(item.id && !String(item.id).startsWith('local_')) await updateDoc(doc(db, collectionName, item.id), { ...item }); else { const { id, ...payload } = item; const created = await addDoc(collection(db, collectionName), payload); item.id = created.id; } saveLocal(); return true; }
async function persistDelete(collectionName, id){ if(!firebaseReady || !db || !id || String(id).startsWith('local_')){ saveLocal(); return false; } const { deleteDoc, doc } = window.firebaseApi; await deleteDoc(doc(db, collectionName, id)); saveLocal(); return true; }

function setRoleUI(){
  if(!currentRole) return;
  const roleLabel = currentRole === 'master_admin' ? 'Admin Mestre' : (currentRole === 'admin' ? 'Admin' : 'User');
  document.body.classList.toggle('role-view-user', currentRole === 'user');
  document.body.classList.toggle('role-view-admin', currentRole === 'admin');
  $('roleBadge').textContent = roleLabel; $('roleLine').textContent = `Role: ${roleLabel}`; $('modeLine').textContent = `Modo: ${dataMode}`; $('versionBadge').textContent = APP_VERSION; $('currentUserName').textContent = currentUsername || 'Utilizador';
  const usersSection = $('usersSection'); if(usersSection) usersSection.style.display = isMasterAdmin() ? 'block' : 'none';
}
function switchTab(tab){ navButtons.forEach(b => b.classList.toggle('active', b.dataset.tab===tab)); bottomButtons.forEach(b => b.classList.toggle('active', b.dataset.tab===tab)); pages.forEach(p => p.classList.toggle('active', p.id===`${tab}-page`)); const btn=document.querySelector(`.nav-btn[data-tab="${tab}"]`); $('pageTitle').textContent = btn ? btn.textContent.trim() : 'Dashboard'; window.scrollTo({top:0,behavior:'smooth'}); }
navButtons.forEach(b => b.addEventListener('click', ()=>switchTab(b.dataset.tab))); bottomButtons.forEach(b => b.addEventListener('click', ()=>switchTab(b.dataset.tab))); document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', ()=>switchTab(b.dataset.go)));

async function ensureUserProfile(firebaseUser){
  const { doc, getDoc, setDoc } = window.firebaseApi;
  const ref = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    const inferredRole = (firebaseUser.email || '').toLowerCase().includes('ricardo') ? 'master_admin' : 'user';
    const username = firebaseUser.displayName || firebaseUser.email || 'Utilizador';
    const profile = { uid: firebaseUser.uid, email: firebaseUser.email || '', username, name: firebaseUser.displayName || username, role: inferredRole };
    await setDoc(ref, profile);
    return profile;
  }
  return snap.data();
}
async function handleSignedInUser(firebaseUser){
  currentUser = firebaseUser;
  const profile = firebaseReady ? await ensureUserProfile(firebaseUser) : null;
  currentRole = profile?.role || 'user';
  currentUsername = profile?.username || firebaseUser.displayName || firebaseUser.email || 'Utilizador';
  await loadData();
  $('loginError').textContent = '';
  $('loginScreen').classList.add('hidden');
  $('appRoot').classList.remove('hidden');
  setRoleUI(); renderAll();
}
async function loginWithGoogle(){
  const errorEl = $('loginError');
  errorEl.textContent = '';
  if(!firebaseReady || !auth || !googleProvider){
    errorEl.textContent = 'Firebase não está configurado. Preenche js/firebase-config.js.';
    return;
  }
  try{
    const { signInWithRedirect } = window.firebaseApi;
    await signInWithRedirect(auth, googleProvider);
  }catch(err){
    console.error(err);
    errorEl.textContent = 'Não foi possível iniciar o login Google.';
  }
}
$('googleLoginBtn').addEventListener('click', loginWithGoogle);
async function logout(){ if(firebaseReady && auth){ const { signOut } = window.firebaseApi; await signOut(auth); } currentRole=null; currentUsername=null; currentUser=null; $('loginScreen').classList.remove('hidden'); $('appRoot').classList.add('hidden'); }
$('logoutBtn').addEventListener('click', logout);

function adminGuard(){ if(!isAdminLike()){ alert('Só o Admin pode fazer alterações.'); return false; } return true; }
function printHtml(title, bodyHtml){ const win=window.open('', '_blank'); if(!win) return; win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}h1,h2{margin:0 0 10px}.meta{color:#555;margin-bottom:20px}.card{border:1px solid #ddd;border-radius:12px;padding:18px;margin:12px 0}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border-bottom:1px solid #ddd;padding:10px;text-align:left}</style></head><body>${bodyHtml}</body></html>`); win.document.close(); setTimeout(()=>{ win.focus(); win.print(); },300); }

function renderDashboard(){ $('statTotalTrabalhos').textContent=trabalhos.length; $('statEmAndamento').textContent=trabalhos.filter(t=>t.estado==='Em andamento'||t.estado==='Pendente').length; $('statConcluidos').textContent=trabalhos.filter(t=>t.estado==='Concluído'||t.estado==='Pago').length; $('statTotalFaturado').textContent=euro(trabalhos.reduce((s,t)=>s+Number(t.valor||0),0));
 const recentWrap=$('recentTrabalhos'); recentWrap.innerHTML = !trabalhos.length ? '<div class="recent-item">Ainda não tens trabalhos registados.</div>' : [...trabalhos].slice(-5).reverse().map(t=>`<div class="recent-item"><div class="mini-label">${escapeHtml(t.estado||'Sem estado')}</div><strong>${escapeHtml(t.cliente||'-')}</strong><div>${escapeHtml(t.tipoTrabalho||'-')}</div><div class="recent-meta">${euro(t.valor||0)} • ${fmtDate(t.dataInicio)} → ${fmtDate(t.dataFim)}</div></div>`).join('');
 const monthMap={}; trabalhos.forEach(t=>{ if(!t.dataInicio) return; const d=new Date(t.dataInicio); if(isNaN(d)) return; const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; monthMap[key]=(monthMap[key]||0)+Number(t.valor||0);}); const entries=Object.entries(monthMap).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6); const max=Math.max(...entries.map(([,v])=>v),1); $('monthlyBars').innerHTML = entries.length ? entries.map(([m,v])=>`<div class="bar-row"><span>${m}</span><div class="bar-track"><div class="bar-fill" style="width:${(v/max)*100}%"></div></div><strong>${euro(v)}</strong></div>`).join('') : '<div class="recent-item">Sem dados mensais ainda.</div>'; }
function renderAlerts(){ const pend=trabalhos.filter(t=>t.estado==='Pendente').length; const andam=trabalhos.filter(t=>t.estado==='Em andamento').length; const semFim=trabalhos.filter(t=>!t.dataFim).length; $('alertCards').innerHTML = `<div class="alert-card"><span class="mini-label">Pendentes</span><strong>${pend}</strong><p>Trabalhos ainda por arrancar ou fechar.</p></div><div class="alert-card"><span class="mini-label">Em andamento</span><strong>${andam}</strong><p>Serviços que precisam de acompanhamento.</p></div><div class="alert-card"><span class="mini-label">Sem data fim</span><strong>${semFim}</strong><p>Registos que convém completar.</p></div>`; }
function trabalhoActions(t){ const pdf=`<button class="small-btn" onclick="pdfTrabalho('${t.id}')">PDF</button>`; return !isAdminLike() ? pdf : `${pdf}<button class="small-btn" onclick="editTrabalho('${t.id}')">Editar</button><button class="small-btn danger" onclick="deleteTrabalho('${t.id}')">Apagar</button>`; }
function clienteActions(c){ const pdf=`<button class="small-btn" onclick="pdfCliente('${c.id}')">PDF</button>`; return !isAdminLike() ? pdf : `${pdf}<button class="small-btn" onclick="editCliente('${c.id}')">Editar</button><button class="small-btn danger" onclick="deleteCliente('${c.id}')">Apagar</button>`; }
function pagamentoActions(p){ const pdf=`<button class="small-btn" onclick="pdfPagamento('${p.id}')">PDF</button>`; return !isAdminLike() ? pdf : `${pdf}<button class="small-btn" onclick="editPagamento('${p.id}')">Editar</button><button class="small-btn danger" onclick="deletePagamento('${p.id}')">Apagar</button>`; }
function renderTrabalhos(){ const term=$('searchTrabalhos').value.trim().toLowerCase(); const estado=$('filterEstado').value; const rows=trabalhos.filter(t=>{const a=(t.cliente||'').toLowerCase();const b=(t.tipoTrabalho||'').toLowerCase(); return (!term||a.includes(term)||b.includes(term))&&(!estado||t.estado===estado)}); $('trabalhosTableBody').innerHTML = rows.length ? rows.slice().reverse().map(t=>`<tr><td>${escapeHtml(t.cliente||'-')}</td><td>${escapeHtml(t.tipoTrabalho||'-')}</td><td>${euro(t.valor||0)}</td><td>${fmtDate(t.dataInicio)}</td><td>${fmtDate(t.dataFim)}</td><td><span class="badge">${escapeHtml(t.estado||'-')}</span></td><td><div class="row-actions">${trabalhoActions(t)}</div></td></tr>`).join('') : '<tr><td colspan="7">Sem resultados.</td></tr>'; }
function renderClientes(){ const term=$('searchClientes').value.trim().toLowerCase(); const rows=clientes.filter(c=>{const a=(c.nome||'').toLowerCase();const b=(c.telefone||'').toLowerCase(); return !term||a.includes(term)||b.includes(term)}); $('clientesTableBody').innerHTML = rows.length ? rows.slice().reverse().map(c=>`<tr><td>${escapeHtml(c.nome||'-')}</td><td>${escapeHtml(c.telefone||'-')}</td><td>${escapeHtml(c.email||'-')}</td><td>${escapeHtml(c.nif||'-')}</td><td><div class="row-actions">${clienteActions(c)}</div></td></tr>`).join('') : '<tr><td colspan="5">Sem clientes registados.</td></tr>'; }
function renderPagamentos(){ $('pagamentosTableBody').innerHTML = pagamentos.length ? pagamentos.slice().reverse().map(p=>`<tr><td>${escapeHtml(p.cliente||'-')}</td><td>${escapeHtml(p.referencia||'-')}</td><td>${euro(p.valor||0)}</td><td>${fmtDate(p.data)}</td><td>${escapeHtml(p.metodo||'-')}</td><td><div class="row-actions">${pagamentoActions(p)}</div></td></tr>`).join('') : '<tr><td colspan="6">Sem pagamentos registados.</td></tr>'; }
function renderRelatorios(){ const monthMap={}; trabalhos.forEach(t=>{const source=t.dataInicio||t.dataFim; if(!source) return; const d=new Date(source); if(isNaN(d)) return; const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; monthMap[key]=monthMap[key]||{trabalhos:0,faturado:0}; monthMap[key].trabalhos+=1; monthMap[key].faturado+=Number(t.valor||0);}); const entries=Object.entries(monthMap).sort((a,b)=>b[0].localeCompare(a[0])); $('resumoMensal').innerHTML = entries.length ? entries.map(([m,d])=>`<div class="report-card"><div class="mini-label">${m}</div><div>Trabalhos</div><strong>${d.trabalhos}</strong><div class="recent-meta">Faturado: ${euro(d.faturado)}</div></div>`).join('') : '<div class="report-card">Sem dados para relatório.</div>'; }
function renderAll(){ if(!currentRole) return; setRoleUI(); renderDashboard(); renderAlerts(); renderTrabalhos(); renderClientes(); renderPagamentos(); renderRelatorios(); }

$('searchTrabalhos').addEventListener('input', renderTrabalhos); $('filterEstado').addEventListener('change', renderTrabalhos); $('searchClientes').addEventListener('input', renderClientes);
$('clearTrabalhoBtn').addEventListener('click', ()=>{$('trabalhoForm').reset();$('trabalhoId').value='';}); $('clearClienteBtn').addEventListener('click', ()=>{$('clienteForm').reset();$('clienteId').value='';}); $('clearPagamentoBtn').addEventListener('click', ()=>{$('pagamentoForm').reset();$('pagamentoId').value='';});

$('trabalhoForm').addEventListener('submit', async (e)=>{ e.preventDefault(); if(!adminGuard()) return; const item={ id:$('trabalhoId').value || ('local_'+Date.now().toString(36)), cliente:$('cliente').value.trim(), contacto:$('contacto').value.trim(), tipoTrabalho:$('tipoTrabalho').value.trim(), valor:Number($('valor').value||0), dataInicio:$('dataInicio').value, dataFim:$('dataFim').value, estado:$('estado').value, descricao:$('descricao').value.trim() }; if(!item.cliente||!item.tipoTrabalho){alert('Preenche cliente e tipo de trabalho.');return;} const i=trabalhos.findIndex(x=>x.id===item.id); if(i>=0) trabalhos[i]=item; else trabalhos.push(item); try{ await persistItem('trabalhos', item);}catch{saveLocal()} saveLocal(); $('trabalhoForm').reset(); $('trabalhoId').value=''; renderAll(); });
$('clienteForm').addEventListener('submit', async (e)=>{ e.preventDefault(); if(!adminGuard()) return; const item={ id:$('clienteId').value || ('local_'+Date.now().toString(36)), nome:$('clienteNome').value.trim(), telefone:$('clienteTelefone').value.trim(), email:$('clienteEmail').value.trim(), nif:$('clienteNif').value.trim(), morada:$('clienteMorada').value.trim() }; if(!item.nome){alert('Preenche o nome do cliente.');return;} const i=clientes.findIndex(x=>x.id===item.id); if(i>=0) clientes[i]=item; else clientes.push(item); try{ await persistItem('clientes', item);}catch{saveLocal()} saveLocal(); $('clienteForm').reset(); $('clienteId').value=''; renderAll(); });
$('pagamentoForm').addEventListener('submit', async (e)=>{ e.preventDefault(); if(!adminGuard()) return; const item={ id:$('pagamentoId').value || ('local_'+Date.now().toString(36)), cliente:$('pagamentoCliente').value.trim(), referencia:$('pagamentoReferencia').value.trim(), valor:Number($('pagamentoValor').value||0), data:$('pagamentoData').value, metodo:$('pagamentoMetodo').value, notas:$('pagamentoNotas').value.trim() }; if(!item.cliente){alert('Preenche o cliente do pagamento.');return;} const i=pagamentos.findIndex(x=>x.id===item.id); if(i>=0) pagamentos[i]=item; else pagamentos.push(item); try{ await persistItem('pagamentos', item);}catch{saveLocal()} saveLocal(); $('pagamentoForm').reset(); $('pagamentoId').value=''; renderAll(); });

window.editTrabalho = function(id){ if(!adminGuard()) return; const t=trabalhos.find(x=>x.id===id); if(!t) return; $('trabalhoId').value=t.id; $('cliente').value=t.cliente||''; $('contacto').value=t.contacto||''; $('tipoTrabalho').value=t.tipoTrabalho||''; $('valor').value=t.valor||''; $('dataInicio').value=t.dataInicio||''; $('dataFim').value=t.dataFim||''; $('estado').value=t.estado||'Pendente'; $('descricao').value=t.descricao||''; switchTab('trabalhos'); };
window.deleteTrabalho = async function(id){ if(!adminGuard()) return; if(!confirm('Apagar este trabalho?')) return; trabalhos=trabalhos.filter(x=>x.id!==id); try{ await persistDelete('trabalhos', id);}catch{saveLocal()} saveLocal(); renderAll(); };
window.editCliente = function(id){ if(!adminGuard()) return; const c=clientes.find(x=>x.id===id); if(!c) return; $('clienteId').value=c.id; $('clienteNome').value=c.nome||''; $('clienteTelefone').value=c.telefone||''; $('clienteEmail').value=c.email||''; $('clienteNif').value=c.nif||''; $('clienteMorada').value=c.morada||''; switchTab('clientes'); };
window.deleteCliente = async function(id){ if(!adminGuard()) return; if(!confirm('Apagar este cliente?')) return; clientes=clientes.filter(x=>x.id!==id); try{ await persistDelete('clientes', id);}catch{saveLocal()} saveLocal(); renderAll(); };
window.editPagamento = function(id){ if(!adminGuard()) return; const p=pagamentos.find(x=>x.id===id); if(!p) return; $('pagamentoId').value=p.id; $('pagamentoCliente').value=p.cliente||''; $('pagamentoReferencia').value=p.referencia||''; $('pagamentoValor').value=p.valor||''; $('pagamentoData').value=p.data||''; $('pagamentoMetodo').value=p.metodo||'Dinheiro'; $('pagamentoNotas').value=p.notas||''; switchTab('pagamentos'); };
window.deletePagamento = async function(id){ if(!adminGuard()) return; if(!confirm('Apagar este pagamento?')) return; pagamentos=pagamentos.filter(x=>x.id!==id); try{ await persistDelete('pagamentos', id);}catch{saveLocal()} saveLocal(); renderAll(); };

window.pdfTrabalho = function(id){ const t=trabalhos.find(x=>x.id===id); if(!t) return; printHtml(`Trabalho ${t.cliente}`, `<h1>Ficha de Trabalho</h1><div class='meta'>${escapeHtml(t.cliente||'-')} • ${escapeHtml(t.tipoTrabalho||'-')}</div><div class='card'><strong>Cliente:</strong> ${escapeHtml(t.cliente||'-')}</div><div class='card'><strong>Contacto:</strong> ${escapeHtml(t.contacto||'-')}</div><div class='card'><strong>Tipo de trabalho:</strong> ${escapeHtml(t.tipoTrabalho||'-')}</div><div class='card'><strong>Valor:</strong> ${euro(t.valor||0)}</div><div class='card'><strong>Início:</strong> ${fmtDate(t.dataInicio)}<br><strong>Fim:</strong> ${fmtDate(t.dataFim)}</div><div class='card'><strong>Estado:</strong> ${escapeHtml(t.estado||'-')}</div><div class='card'><strong>Descrição:</strong><br>${escapeHtml(t.descricao||'-')}</div>`); };
window.pdfCliente = function(id){ const c=clientes.find(x=>x.id===id); if(!c) return; const trabalhosCliente=trabalhos.filter(t=>(t.cliente||'').trim().toLowerCase()===(c.nome||'').trim().toLowerCase()); const linhas=trabalhosCliente.map(t=>`<tr><td>${escapeHtml(t.tipoTrabalho||'-')}</td><td>${fmtDate(t.dataInicio)}</td><td>${euro(t.valor||0)}</td></tr>`).join(''); printHtml(`Cliente ${c.nome}`, `<h1>Ficha de Cliente</h1><div class='meta'>${escapeHtml(c.nome||'-')}</div><div class='card'><strong>Telefone:</strong> ${escapeHtml(c.telefone||'-')}</div><div class='card'><strong>Email:</strong> ${escapeHtml(c.email||'-')}</div><div class='card'><strong>NIF:</strong> ${escapeHtml(c.nif||'-')}</div><div class='card'><strong>Morada:</strong><br>${escapeHtml(c.morada||'-')}</div><h2>Trabalhos associados</h2><table><thead><tr><th>Tipo</th><th>Data</th><th>Valor</th></tr></thead><tbody>${linhas || '<tr><td colspan="3">Sem trabalhos associados</td></tr>'}</tbody></table>`); };
window.pdfPagamento = function(id){ const p=pagamentos.find(x=>x.id===id); if(!p) return; printHtml(`Pagamento ${p.cliente}`, `<h1>Comprovativo de Pagamento</h1><div class='meta'>${escapeHtml(p.cliente||'-')}</div><div class='card'><strong>Cliente:</strong> ${escapeHtml(p.cliente||'-')}</div><div class='card'><strong>Referência:</strong> ${escapeHtml(p.referencia||'-')}</div><div class='card'><strong>Valor:</strong> ${euro(p.valor||0)}</div><div class='card'><strong>Data:</strong> ${fmtDate(p.data)}</div><div class='card'><strong>Método:</strong> ${escapeHtml(p.metodo||'-')}</div><div class='card'><strong>Notas:</strong><br>${escapeHtml(p.notas||'-')}</div>`); };

function exportBackup(){ const payload={ exportadoEm:new Date().toISOString(), appVersion:APP_VERSION, dataMode, currentUsername, currentRole, trabalhos, clientes, pagamentos }; const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='gestao-empresa-backup.json'; a.click(); URL.revokeObjectURL(a.href); }
$('exportBackupBtn').addEventListener('click', exportBackup);
$('exportMonthlyPdfBtn').addEventListener('click', ()=>{ const html=$('resumoMensal').innerHTML; printHtml('Relatório mensal', `<h1>Relatório Mensal</h1><div style="display:grid;gap:14px">${html}</div>`); });

async function checkForUpdates(){ try{ const res=await fetch(`./version.json?v=${Date.now()}`, { cache:'no-store' }); if(!res.ok) return; const data=await res.json(); const lastSeen=localStorage.getItem(VERSION_KEY); if(lastSeen && data.version && data.version!==lastSeen){ /* reserved */ } if(data.version){ localStorage.setItem(VERSION_KEY,data.version); if($('versionBadge')) $('versionBadge').textContent=data.version; } }catch(err){ console.log('Sem verificação de update:', err);} }

(async function init(){
  const ok = await initFirebase();
  await checkForUpdates();

  if(ok && auth){
    try{
      const { getRedirectResult, onAuthStateChanged } = window.firebaseApi;
      const redirectResult = await getRedirectResult(auth);
      if(redirectResult && redirectResult.user){
        await handleSignedInUser(redirectResult.user);
      }

      onAuthStateChanged(auth, async (user) => {
        if(user){
          await handleSignedInUser(user);
        } else {
          currentRole = null;
          currentUsername = null;
          currentUser = null;
          $('loginScreen').classList.remove('hidden');
          $('appRoot').classList.add('hidden');
        }
      });
    }catch(err){
      console.error(err);
      $('loginError').textContent = 'Erro no login Google. Confirma Google Sign-In e Authorized domains no Firebase.';
    }
  } else {
    $('loginError').textContent = 'Firebase ainda não está configurado. Preenche js/firebase-config.js.';
  }
})();
