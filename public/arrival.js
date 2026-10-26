(() => {
  const quotes = ['Different codes. One dilemma. Your call.', 'Make room for a different perspective.', 'A thoughtful question opens the discussion.'];
  let index = 0, finished = false;
  const rotate = setInterval(() => {
    index = (index + 1) % quotes.length;
    for (const id of ['boot-quote', 'waiting-quote']) {
      const node = document.getElementById(id); if (node) node.textContent = quotes[index];
    }
  }, 4200);
  function fail(message) {
    if (finished) return;
    document.getElementById('boot-status').textContent = message;
    document.getElementById('boot-retry').hidden = false;
  }
  const timeout = setTimeout(() => fail('Taking longer than expected. You can wait or try again.'), 25000);
  window.addEventListener('goc-ready', () => {
    finished = true; clearTimeout(timeout); document.getElementById('boot-screen').hidden = true;
  });
  window.addEventListener('goc-boot-error', event => fail(event.detail || 'The court could not open. Please try again.'));
  window.addEventListener('error', event => {
    if (event.target?.tagName === 'SCRIPT' || event.error) fail('The court could not open. Please try again.');
  }, true);
  window.addEventListener('pagehide', () => clearInterval(rotate));
})();
