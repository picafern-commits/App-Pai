const USERS = [
  { username: 'Ricardo', password: '2297', role: 'master_admin' },
  { username: 'admin', password: 'admin123', role: 'admin' },
  { username: 'user', password: 'user123', role: 'user' }
];

let currentRole = null;
let currentUsername = null;

function initLogin(){

  const loginForm = document.getElementById('loginForm');
  if(!loginForm) return;

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

    currentRole = found.role;
    currentUsername = found.username;

    document.getElementById('loginError').textContent = '';
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appRoot').classList.remove('hidden');

    // chama a app
    if(window.startApp){
      window.startApp(currentRole, currentUsername);
    }
  });

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    currentRole = null;
    currentUsername = null;

    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('appRoot').classList.add('hidden');
    loginForm.reset();
  });
}

document.addEventListener('DOMContentLoaded', initLogin);
