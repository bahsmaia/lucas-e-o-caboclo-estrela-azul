/* Lucas e o Caboclo Estrela Azul — trilha sonora e efeito de botões.
 * A reprodução com som começa após o clique em Iniciar (política dos navegadores).
 */
(function () {
  'use strict';
  if (window.__estrelaAzulSoundInitialized) return;
  window.__estrelaAzulSoundInitialized = true;

  var mediaBase = new URL('./public/assets/', document.baseURI);
  var music = new Audio(new URL('trilha-estrela-azul.mp3', mediaBase).href);
  var pop = new Audio(new URL('pop-botoes.mp3', mediaBase).href);
  music.loop = true;
  music.preload = 'auto';
  music.volume = 0.18;  // trilha mais baixa, como um ruído branco suave durante o passeio
  pop.preload = 'auto';
  pop.volume = 0.7;
  var startedMusic = false;

  function playPop() {
    try {
      var sound = pop.paused || pop.ended ? pop : pop.cloneNode();
      sound.volume = 0.7;
      sound.currentTime = 0;
      var promise = sound.play();
      if (promise && typeof promise.catch === 'function') promise.catch(function () {});
    } catch (_) { /* A navegação continua mesmo sem áudio. */ }
  }
  function startMusic() {
    if (startedMusic && !music.paused) return;
    startedMusic = true;
    try {
      var promise = music.play();
      if (promise && typeof promise.catch === 'function') promise.catch(function () { startedMusic = false; });
    } catch (_) { startedMusic = false; }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (!music.paused) music.pause();
    } else if (startedMusic) {
      var promise = music.play();
      if (promise && typeof promise.catch === 'function') promise.catch(function () {});
    }
  });
  // Escuta inclusive os controles renderizados dinamicamente pelo React.
  document.addEventListener('click', function (event) {
    var target = event.target instanceof Element ? event.target : null;
    var interactive = target && target.closest('button, a.home-exit-link');
    if (!interactive || interactive.disabled || interactive.getAttribute('aria-disabled') === 'true') return;
    playPop();
    if (interactive.matches('.intro-start-button') || (interactive.matches('.play') && !startedMusic)) startMusic();
    // Pequena folga para o efeito "pop" ser ouvido antes da saída do site.
    if (interactive.matches('a.home-exit-link') && !event.defaultPrevented && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && (!interactive.target || interactive.target === '_self')) {
      var href = interactive.href;
      if (href) {
        event.preventDefault();
        music.pause();
        window.setTimeout(function () { window.location.assign(href); }, 180);
      }
    }
  }, true);
  window.addEventListener('pagehide', function () { music.pause(); });
})();
