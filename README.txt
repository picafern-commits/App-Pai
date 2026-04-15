App-Pai online corrigida

Esta versão já vem corrigida para GitHub Pages:
- index.html com script module
- js/firebase-config.js no sítio certo
- login Google por redirect
- sincronização Firebase automática
- backup local invisível

Muito importante no Firebase:
1. Authentication > Método de login > Google = ativo
2. Authentication > Settings > Authorized domains:
   - picafern-commits.github.io
3. Firestore Database criado
4. coleção users criada quando fizeres login

No GitHub:
- substitui os ficheiros antigos por estes
- apaga firebase-config.js da raiz se existir
- mantém só js/firebase-config.js
