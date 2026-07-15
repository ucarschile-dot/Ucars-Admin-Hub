(function () {
  var currentPath = window.location.pathname;

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
    markActiveNav();
    enableSmoothNavigation();

    window.requestAnimationFrame(function () {
      document.body.classList.add('stitch-ready');
    });
  });
})();
