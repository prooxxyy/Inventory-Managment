// Already signed in? Go straight to the dashboard.
if (isSignedIn()) location.replace('dashboard.html');

$('signinForm').onsubmit = async e => {
  e.preventDefault();
  const id = $('si-email').value.trim().toLowerCase();
  const u = users.find(u => u.email === id || (u.username && u.username === id));
  if (!u) {
    $('si-err').textContent = 'No account found with that email or username in this browser.';
    return;
  }
  if (u.pass !== await hash($('si-pass').value)) {
    $('si-err').textContent = 'Incorrect password. Try again.';
    return;
  }
  session = u.email;
  store.set('ci_session', session);
  location.href = 'dashboard.html';
};