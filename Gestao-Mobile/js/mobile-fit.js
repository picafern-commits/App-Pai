/* Mobile Fit - dá etiquetas às células das tabelas para que, em ecrãs
   pequenos, cada linha seja mostrada como um cartão (ver css/mobile-fit.css).
   Não altera dados nem lógica da app; só acrescenta atributos data-label. */
(function () {
  'use strict';

  function labelTable(table) {
    var heads = Array.prototype.map.call(
      table.querySelectorAll('thead th'),
      function (th) { return (th.textContent || '').trim(); }
    );
    if (!heads.length) return;                 // sem cabeçalho: fica como está
    table.classList.add('m-stack');
    Array.prototype.forEach.call(table.querySelectorAll('tbody tr'), function (tr) {
      Array.prototype.forEach.call(tr.children, function (td, i) {
        if (td.tagName !== 'TD' || td.hasAttribute('colspan')) return;
        if (heads[i] && td.getAttribute('data-label') !== heads[i]) {
          td.setAttribute('data-label', heads[i]);
        }
      });
    });
  }

  function run() {
    Array.prototype.forEach.call(document.querySelectorAll('table'), labelTable);
  }

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; run(); });
  }

  function start() {
    run();
    // as tabelas são (re)desenhadas pela app; só observamos inserções de nós
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
