// Settings page: edit name, username, and password (needs common.js)
if (!isSignedIn()) location.replace('signin.html');
const me = users.find(u => u.email === session);
if (me) { $('s-name').value = me.name; $('s-user').value = me.username || ''; $('s-email').value = me.email; }

$('signout').onclick = () => { session = null; store.set('ci_session', null); location.href = 'signin.html'; };

function say(id, text, ok){ $(id).textContent = text; $(id).className = 'err' + (ok ? ' ok' : ''); }

$('profileForm').onsubmit = e => {
  e.preventDefault();
  const name = $('s-name').value.trim();
  const username = $('s-user').value.trim().toLowerCase();
  if (!name) return say('p-msg', 'Please enter your name.');
  if (username && !/^[a-z0-9_.]{3,20}$/.test(username)) return say('p-msg', 'Username must be 3 to 20 letters, numbers, dots or underscores.');
  if (username && users.some(u => u !== me && (u.username === username || u.email === username))) return say('p-msg', 'That username is already taken.');
  me.name = name;
  if (username) me.username = username; else delete me.username;
  saveUsers();
  const items = store.get('ci_items', []);   // keep the name on existing borrow requests up to date
  items.forEach(i => (i.loans || []).forEach(l => { if (l.by === me.email) l.name = name; }));
  store.set('ci_items', items);
  $('s-user').value = username;
  say('p-msg', 'Profile saved.', true);
};

$('passForm').onsubmit = async e => {
  e.preventDefault();
  if (me.pass !== await hash($('w-cur').value)) return say('w-msg', 'Current password is incorrect.');
  if ($('w-new').value !== $('w-confirm').value) return say('w-msg', 'The new passwords do not match.');
  me.pass = await hash($('w-new').value);
  saveUsers();
  e.target.reset();
  say('w-msg', 'Password updated.', true);
};