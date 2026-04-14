GESTÃO EMPRESA - VERSÃO FIREBASE

O que esta versão já faz:
- Registar trabalhos
- Editar trabalhos
- Apagar trabalhos
- Dashboard com totais
- Pesquisa por cliente
- Filtro por estado
- Funciona em PC e Android
- Modo local de segurança caso o Firebase ainda não esteja configurado

COMO LIGAR AO FIREBASE
1) Vai a https://console.firebase.google.com/
2) Cria um projeto
3) Adiciona uma app Web
4) Ativa Firestore Database
5) Abre o ficheiro firebase-config.js
6) Cola os dados reais do teu projeto

REGRAS FIRESTORE PARA TESTE
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}

ATENÇÃO:
Estas regras são só para arranque rápido/teste.
Depois convém apertar a segurança.

COMO USAR
- Abre index.html num servidor local ou coloca os ficheiros num hosting
- Para Android, podes instalar como app web
- Para PC, podes usar no browser ou depois transformar em app desktop
