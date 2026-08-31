(function () {
  // Ruta actual usada para resaltar el modulo activo y evitar navegar hacia la misma pantalla.
  var currentPath = window.location.pathname;

  // Sincroniza el estado visual y accesible de los enlaces de la barra lateral.
  function markActiveNav() {
    var navLinks = document.querySelectorAll('a[href^="/stitch-export/"]');
    navLinks.forEach(function (link) {
      var href = link.getAttribute('href');
      var isActive = href === currentPath;

      link.classList.toggle('stitch-active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  // Aplica una breve transicion de salida antes de cambiar entre pantallas exportadas.
  function enableSmoothNavigation() {
    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!(target instanceof Element)) return;

      var link = target.closest('a[href^="/stitch-export/"]');
      if (!link) return;

      var href = link.getAttribute('href');
      if (!href || href === currentPath) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      document.body.classList.add('stitch-leaving');

      window.setTimeout(function () {
        window.location.assign(href);
      }, 120);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Prepara navegacion y revela el contenido solo cuando el DOM ya esta disponible.
    markActiveNav();
    enableSmoothNavigation();

    window.requestAnimationFrame(function () {
      document.body.classList.add('stitch-ready');
    });
  });
})();
