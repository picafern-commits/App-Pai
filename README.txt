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


Backup semanal Excel 5.3.0:
- gera ficheiro .xlsx com Trabalhos, Clientes, Pagamentos e Resumo
- faz verificação automática semanal depois do login
- mantém botão manual 'Backup Excel' em Configurações
- em alguns browsers pode pedir confirmação de download por segurança


Backup Excel profissional 5.3.1:
- nome de ficheiro mais profissional
- folhas: Resumo Geral, Trabalhos, Clientes, Pagamentos
- larguras de colunas ajustadas
- metadados do ficheiro configurados


Backup Excel profissional plus 5.3.2:
- cabeçalho da empresa no Excel
- totais destacados no Resumo Geral
- folhas mais organizadas para leitura imediata
