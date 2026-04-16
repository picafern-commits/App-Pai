App Pai 5.0.0 - Firebase Sync a sério

Esta versão liga dispositivos entre si por Cloud Firestore.

Mantém:
- login interno da app
- visual premium
- faturas PDF
- histórico do cliente
- permissões

Firebase necessário:
1. Authentication > Sign-in method > Anonymous = ATIVO
2. Firestore Database criado
3. Regras Firestore publicadas

Regras recomendadas para esta versão:
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}

Coleções usadas:
- trabalhos
- clientes
- pagamentos

Como funciona:
- a app faz sign-in anónimo no Firebase
- depois sincroniza em tempo real entre dispositivos
- continua a guardar backup local invisível

Se o Firebase falhar, a app continua a abrir em modo local.


Ajustes clean Jorge Torneiro:
- removido conteúdo extra do login
- Gestão Empresa alterado para Jorge Torneiro
- backup JSON movido para Configurações
- logos GE substituídos pelo logo da empresa
- layout mais clean


Correção 5.1.1:
- revertido para base estável com login funcional
- removidas alterações que estavam a bloquear o botão Entrar


Correção inputs 5.1.2:
- removido código que estava a interferir com escrita nos campos
- mantida a base estável com login funcional
- versão segura para voltar a trabalhar sem bloqueios


Login automático 5.5.0:
- login separado em js/login.js
- sessão guardada no browser
- auto-login ao abrir a app
- logout limpa a sessão


Reorganização 5.6.0 (sem mexer no login):
- página nova Adicionar Trabalho
- Trabalhos fica só histórico
- Pagamentos fica só registo dos pagamentos
- Relatórios por cliente e mês
- clientes criados ficam disponíveis ao adicionar trabalho


Correção layout + login 1.0.6:
- páginas voltam a ficar ao lado da sidebar
- credenciais atualizadas para Jorge / jfernandes e Fátima / ffernandes
- login separado mantido
