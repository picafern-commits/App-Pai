
const USERS = [
  { username: 'jorge', password: 'jfernandes', role: 'admin' },
  { username: 'fatima', password: 'ffernandes', role: 'user' }
];

const loginForm = document.getElementById('loginForm');

function saveSession(role, username){
  localStorage.setItem('app_session', JSON.stringify({ role, username }));
}

function readSession(){
  return JSON.parse(localStorage.getItem('app_session') || 'null');
}

function clearSession(){
  localStorage.removeItem('app_session');
}

function showApp(){
  document.getElementById('loginScreen')?.classList.add('hidden');
  document.getElementById('appRoot')?.classList.remove('hidden');
}

function showLogin(){
  document.getElementById('loginScreen')?.classList.remove('hidden');
  document.getElementById('appRoot')?.classList.add('hidden');
}

function bootFromSession(){
  const session = readSession();
  if(!session || !window.startApp) return false;

  showApp();
  window.startApp(session.role, session.username);
  return true;
}

loginForm?.addEventListener('submit', (e) => {
  e.preventDefault();

  const username = document.getElementById('loginUsername').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;

  const found = USERS.find(
    u => u.username.toLowerCase() === username && u.password === password
  );

  if (!found) {
    document.getElementById('loginError').textContent = 'Credenciais inválidas.';
    return;
  }

  saveSession(found.role, found.username);
  document.getElementById('loginError').textContent = '';
  showApp();

  if(window.startApp){
    window.startApp(found.role, found.username);
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  clearSession();
  showLogin();
  loginForm.reset();
});

document.addEventListener('DOMContentLoaded', () => {
  if(!bootFromSession()){
    showLogin();
  }
});
