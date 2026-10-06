// Already signed in? Go straight to the dashboard.
if (isSignedIn()) location.replace('dashboard.html');

$('signupForm').onsubmit = async e => {
  e.preventDefault();
  if ($('su-pass').value !== $('su-confirm').value) {
    $('su-err').textContent = 'Passwords do not match. Retype them and try again.';
    return;
  }
  const email = $('su-email').value.trim().toLowerCase();
  if (users.some(u => u.email === email)) {
    $('su-err').textContent = 'That email already has an account. Sign in instead.';
    return;
  }
  users.push({ name: $('su-name').value.trim(), email, pass: await hash($('su-pass').value), role: users.length ? 'borrower' : 'admin' });
  saveUsers();
  session = email;
  store.set('ci_session', session);
  location.href = 'dashboard.html';
};