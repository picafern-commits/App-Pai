const USERS = [
  { username: 'Jorge', password: 'jfernandes', role: 'master_admin' },
  { username: 'Fátima', password: 'ffernandes', role: 'user' }
];

function saveSession(role, username){
  localStorage.setItem('jt_login_session', JSON.stringify({ role, username }));
}

function clearSession(){
  localStorage.removeItem('jt_login_session');
}

function readSession(){
  try{
    return JSON.parse(localStorage.getItem('jt_login_session')) || null;
  }catch{
    return null;
  }
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

function initLogin(){
  const loginForm = document.getElementById('loginForm');
  if(!loginForm) return;

  if(bootFromSession()) return;

  loginForm.addEventListener('submit', (e) => {
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

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    clearSession();
    showLogin();
    loginForm.reset();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initLogin();
  setTimeout(() => {
    if(document.getElementById('appRoot')?.classList.contains('hidden') && readSession() && window.startApp){
      const s = readSession();
      showApp();
      window.startApp(s.role, s.username);
    }
  }, 50);
});
