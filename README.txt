Gestão Empresa Pro - Android

Conteúdo:
- index.html
- css/style.css
- js/app.js
- js/auth-config.js
- js/firebase-config.js
- version.json
- manifest.json

Login:
- admin / admin123
- user / user123

Diferença de permissões:
- Admin: cria, edita, apaga
- User: só consulta

Auto-update:
- Para lançar nova versão, altera o número em version.json
- Exemplo: 1.0.0 -> 1.0.1
- Depois publica os ficheiros novos no GitHub
- A app avisa que existe nova versão

Firebase:
- Cola a config em js/firebase-config.js
- Sem Firebase, a app funciona em modo local

Publicação:
1. Extrai o ZIP
2. Apaga os ficheiros antigos do repositório
3. Envia todos os ficheiros mantendo as pastas
4. Faz refresh forte no browser
