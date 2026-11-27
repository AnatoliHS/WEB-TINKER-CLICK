// Runs in <head>, before the page paints. A file, not an inline <script>: tinker.click's
// Content-Security-Policy runs scripts from files only.
(() => {
  const root = document.documentElement;
  // Flag JS early so reveal animations never hide content without it
  root.classList.add('js');
  // Intro (component/intro.njk): plays on every load, except with reduced motion
  if (root.hasAttribute('data-intro') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('has-intro');
  }
})();
