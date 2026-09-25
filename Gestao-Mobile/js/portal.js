/* Mantém a class body.on-portal sincronizada com a página realmente ativa.
   O switchTab() do app.js já faz este toggle ao navegar; isto é só uma
   rede de segurança para o estado inicial (antes do primeiro clique) e
   para qualquer troca de página que não passe por switchTab(). */
(function () {
  'use strict';

  function syncPortalState() {
    var portal = document.getElementById('portal-page');
    document.body.classList.toggle('on-portal', !!(portal && portal.classList.contains('active')));
  }

  function start() {
    syncPortalState();
    var root = document.getElementById('appRoot');
    if (root) {
      new MutationObserver(syncPortalState).observe(root, {
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
