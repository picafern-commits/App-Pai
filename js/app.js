
const STORAGE_KEYS = {
  trabalhos: 'ge_trabalhos',
  clientes: 'ge_clientes',
  pagamentos: 'ge_pagamentos'
};

let trabalhos = loadData(STORAGE_KEYS.trabalhos);
let clientes = loadData(STORAGE_KEYS.clientes);
let pagamentos = loadData(STORAGE_KEYS.pagamentos);

function loadData(key){
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}
function saveData(key, data){
  localStorage.setItem(key, JSON.stringify(data));
}
function uid(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}
function euro(value){
  const n = Number(value || 0);
  return n.toLocaleString('pt-PT', {style:'currency', currency:'EUR'});
}
function fmtDate(value){
  if(!value) return '-';
  return new Date(value).toLocaleDateString('pt-PT');
}
function escapeHtml(str=''){
  return String(str).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

const pageTitle = document.getElementById('pageTitle');
const navButtons = document.querySelectorAll('.nav-btn');
const pages = document.querySelectorAll('.page');

function switchTab(tab){
  navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  pages.forEach(page => page.classList.toggle('active', page.id === `${tab}-page`));
  const current = document.querySelector(`.nav-btn[data-tab="${tab}"]`);
  pageTitle.textContent = current ? current.textContent : 'Dashboard';
  document.getElementById('sidebar').classList.remove('open');
}
navButtons.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
document.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.go)));
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

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
    recentWrap.innerHTML = '<div class="empty-state">Sem trabalhos registados.</div>';
  } else {
    const recent = [...trabalhos].slice(-5).reverse();
    recentWrap.innerHTML = recent.map(t => `
      <div class="report-card">
        <div class="eyebrow">${escapeHtml(t.estado)}</div>
        <strong>${escapeHtml(t.cliente)}</strong>
        <div>${escapeHtml(t.tipoTrabalho)}</div>
        <div style="margin-top:8px;color:#94a3b8">${euro(t.valor)} • ${fmtDate(t.dataInicio)} → ${fmtDate(t.dataFim)}</div>
      </div>
    `).join('');
  }

  const months = {};
  trabalhos.forEach(t => {
    if(!t.dataInicio) return;
    const d = new Date(t.dataInicio);
    if (isNaN(d)) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    months[key] = (months[key] || 0) + Number(t.valor || 0);
  });

  const entries = Object.entries(months).sort((a,b) => a[0].localeCompare(b[0])).slice(-6);
  const max = Math.max(...entries.map(([,v]) => v), 1);
  const bars = document.getElementById('monthlyBars');
  if(!entries.length){
    bars.innerHTML = '<div class="empty-state">Ainda não há dados mensais.</div>';
  } else {
    bars.innerHTML = entries.map(([month, value]) => `
      <div class="bar-row">
        <span>${month}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(value/max)*100}%"></div></div>
        <strong>${euro(value)}</strong>
      </div>
    `).join('');
  }
}

const trabalhoForm = document.getElementById('trabalhoForm');
trabalhoForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const item = {
    id: document.getElementById('trabalhoId').value || uid(),
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
    alert('Preenche pelo menos cliente e tipo de trabalho.');
    return;
  }
  const idx = trabalhos.findIndex(t => t.id === item.id);
  if(idx >= 0) trabalhos[idx] = item;
  else trabalhos.push(item);
  saveData(STORAGE_KEYS.trabalhos, trabalhos);
  clearTrabalhoForm();
  renderAll();
});
document.getElementById('clearTrabalhoBtn').addEventListener('click', clearTrabalhoForm);

function clearTrabalhoForm(){
  trabalhoForm.reset();
  document.getElementById('trabalhoId').value = '';
}

function renderTrabalhos(){
  const term = document.getElementById('searchTrabalhos').value.trim().toLowerCase();
  const estado = document.getElementById('filterEstado').value;
  const body = document.getElementById('trabalhosTableBody');

  const filtered = trabalhos.filter(t => {
    const cliente = (t.cliente || '').toLowerCase();
    const tipo = (t.tipoTrabalho || '').toLowerCase();
    const matchTerm = !term || cliente.includes(term) || tipo.includes(term);
    const matchEstado = !estado || t.estado === estado;
    return matchTerm && matchEstado;
  });

  if(!filtered.length){
    body.innerHTML = `<tr><td colspan="7" style="color:#94a3b8">Sem resultados.</td></tr>`;
    return;
  }

  body.innerHTML = filtered.slice().reverse().map(t => `
    <tr>
      <td>${escapeHtml(t.cliente)}</td>
      <td>${escapeHtml(t.tipoTrabalho)}</td>
      <td>${euro(t.valor)}</td>
      <td>${fmtDate(t.dataInicio)}</td>
      <td>${fmtDate(t.dataFim)}</td>
      <td><span class="tag">${escapeHtml(t.estado)}</span></td>
      <td>
        <div class="row-actions">
          <button class="mini-btn" onclick="editTrabalho('${t.id}')">Editar</button>
          <button class="mini-btn danger" onclick="deleteTrabalho('${t.id}')">Apagar</button>
        </div>
      </td>
    </tr>
  `).join('');
}
window.editTrabalho = function(id){
  const t = trabalhos.find(x => x.id === id);
  if(!t) return;
  document.getElementById('trabalhoId').value = t.id;
  document.getElementById('cliente').value = t.cliente;
  document.getElementById('contacto').value = t.contacto || '';
  document.getElementById('tipoTrabalho').value = t.tipoTrabalho;
  document.getElementById('valor').value = t.valor;
  document.getElementById('dataInicio').value = t.dataInicio || '';
  document.getElementById('dataFim').value = t.dataFim || '';
  document.getElementById('estado').value = t.estado;
  document.getElementById('descricao').value = t.descricao || '';
  switchTab('trabalhos');
  window.scrollTo({top:0, behavior:'smooth'});
}
window.deleteTrabalho = function(id){
  if(!confirm('Apagar este trabalho?')) return;
  trabalhos = trabalhos.filter(t => t.id !== id);
  saveData(STORAGE_KEYS.trabalhos, trabalhos);
  renderAll();
}
document.getElementById('searchTrabalhos').addEventListener('input', renderTrabalhos);
document.getElementById('filterEstado').addEventListener('change', renderTrabalhos);

const clienteForm = document.getElementById('clienteForm');
clienteForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const item = {
    id: document.getElementById('clienteId').value || uid(),
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
  const idx = clientes.findIndex(c => c.id === item.id);
  if(idx >= 0) clientes[idx] = item;
  else clientes.push(item);
  saveData(STORAGE_KEYS.clientes, clientes);
  clearClienteForm();
  renderAll();
});
document.getElementById('clearClienteBtn').addEventListener('click', clearClienteForm);

function clearClienteForm(){
  clienteForm.reset();
  document.getElementById('clienteId').value = '';
}
function renderClientes(){
  const term = document.getElementById('searchClientes').value.trim().toLowerCase();
  const body = document.getElementById('clientesTableBody');
  const filtered = clientes.filter(c => {
    const nome = (c.nome || '').toLowerCase();
    const telefone = (c.telefone || '').toLowerCase();
    return !term || nome.includes(term) || telefone.includes(term);
  });

  if(!filtered.length){
    body.innerHTML = `<tr><td colspan="5" style="color:#94a3b8">Sem clientes registados.</td></tr>`;
    return;
  }
  body.innerHTML = filtered.slice().reverse().map(c => `
    <tr>
      <td>${escapeHtml(c.nome)}</td>
      <td>${escapeHtml(c.telefone || '-')}</td>
      <td>${escapeHtml(c.email || '-')}</td>
      <td>${escapeHtml(c.nif || '-')}</td>
      <td>
        <div class="row-actions">
          <button class="mini-btn" onclick="editCliente('${c.id}')">Editar</button>
          <button class="mini-btn danger" onclick="deleteCliente('${c.id}')">Apagar</button>
        </div>
      </td>
    </tr>
  `).join('');
}
window.editCliente = function(id){
  const c = clientes.find(x => x.id === id);
  if(!c) return;
  document.getElementById('clienteId').value = c.id;
  document.getElementById('clienteNome').value = c.nome;
  document.getElementById('clienteTelefone').value = c.telefone || '';
  document.getElementById('clienteEmail').value = c.email || '';
  document.getElementById('clienteNif').value = c.nif || '';
  document.getElementById('clienteMorada').value = c.morada || '';
  switchTab('clientes');
  window.scrollTo({top:0, behavior:'smooth'});
}
window.deleteCliente = function(id){
  if(!confirm('Apagar este cliente?')) return;
  clientes = clientes.filter(c => c.id !== id);
  saveData(STORAGE_KEYS.clientes, clientes);
  renderAll();
}
document.getElementById('searchClientes').addEventListener('input', renderClientes);

const pagamentoForm = document.getElementById('pagamentoForm');
pagamentoForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const item = {
    id: document.getElementById('pagamentoId').value || uid(),
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
  const idx = pagamentos.findIndex(p => p.id === item.id);
  if(idx >= 0) pagamentos[idx] = item;
  else pagamentos.push(item);
  saveData(STORAGE_KEYS.pagamentos, pagamentos);
  clearPagamentoForm();
  renderAll();
});
document.getElementById('clearPagamentoBtn').addEventListener('click', clearPagamentoForm);

function clearPagamentoForm(){
  pagamentoForm.reset();
  document.getElementById('pagamentoId').value = '';
}
function renderPagamentos(){
  const body = document.getElementById('pagamentosTableBody');
  if(!pagamentos.length){
    body.innerHTML = `<tr><td colspan="6" style="color:#94a3b8">Sem pagamentos registados.</td></tr>`;
    return;
  }
  body.innerHTML = pagamentos.slice().reverse().map(p => `
    <tr>
      <td>${escapeHtml(p.cliente)}</td>
      <td>${escapeHtml(p.referencia || '-')}</td>
      <td>${euro(p.valor)}</td>
      <td>${fmtDate(p.data)}</td>
      <td>${escapeHtml(p.metodo)}</td>
      <td>
        <div class="row-actions">
          <button class="mini-btn" onclick="editPagamento('${p.id}')">Editar</button>
          <button class="mini-btn danger" onclick="deletePagamento('${p.id}')">Apagar</button>
        </div>
      </td>
    </tr>
  `).join('');
}
window.editPagamento = function(id){
  const p = pagamentos.find(x => x.id === id);
  if(!p) return;
  document.getElementById('pagamentoId').value = p.id;
  document.getElementById('pagamentoCliente').value = p.cliente;
  document.getElementById('pagamentoReferencia').value = p.referencia || '';
  document.getElementById('pagamentoValor').value = p.valor;
  document.getElementById('pagamentoData').value = p.data || '';
  document.getElementById('pagamentoMetodo').value = p.metodo || 'Dinheiro';
  document.getElementById('pagamentoNotas').value = p.notas || '';
  switchTab('pagamentos');
  window.scrollTo({top:0, behavior:'smooth'});
}
window.deletePagamento = function(id){
  if(!confirm('Apagar este pagamento?')) return;
  pagamentos = pagamentos.filter(p => p.id !== id);
  saveData(STORAGE_KEYS.pagamentos, pagamentos);
  renderAll();
}

function renderRelatorios(){
  const el = document.getElementById('resumoMensal');
  const byMonth = {};
  trabalhos.forEach(t => {
    const source = t.dataInicio || t.dataFim;
    if(!source) return;
    const d = new Date(source);
    if (isNaN(d)) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    byMonth[key] = byMonth[key] || {trabalhos:0, faturado:0};
    byMonth[key].trabalhos += 1;
    byMonth[key].faturado += Number(t.valor || 0);
  });

  const months = Object.entries(byMonth).sort((a,b) => b[0].localeCompare(a[0]));
  if(!months.length){
    el.innerHTML = '<div class="empty-state">Sem dados suficientes para relatórios.</div>';
    return;
  }
  el.innerHTML = months.map(([month, data]) => `
    <div class="report-card">
      <div class="eyebrow">${month}</div>
      <div>Trabalhos</div>
      <strong>${data.trabalhos}</strong>
      <div style="margin-top:10px;color:#94a3b8">Faturado: ${euro(data.faturado)}</div>
    </div>
  `).join('');
}

function exportBackup(){
  const payload = {
    exportadoEm: new Date().toISOString(),
    trabalhos, clientes, pagamentos
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gestao-empresa-backup.json';
  a.click();
  URL.revokeObjectURL(url);
}
document.getElementById('exportBackupBtn').addEventListener('click', exportBackup);
document.getElementById('exportBackupBtn2').addEventListener('click', exportBackup);

function renderAll(){
  renderDashboard();
  renderTrabalhos();
  renderClientes();
  renderPagamentos();
  renderRelatorios();
}

renderAll();
