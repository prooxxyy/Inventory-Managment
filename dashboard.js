// Dashboard page (needs common.js)
// Not signed in? Back to the sign in page.
if (!isSignedIn()) location.replace('signin.html');
const me = users.find(u => u.email === session);
const isAdmin = !!me && me.role === 'admin';
$('who').textContent = me ? me.name + ' (' + me.role + ')' : '';
if (isAdmin) { $('usersTab').classList.remove('hidden'); document.querySelector('.tabs').classList.add('wide'); }
else {   // borrowers get a view-only catalog of cards titled "Items for borrowing"
  $('add').classList.add('hidden'); $('addCat').classList.add('hidden');
  document.title = 'Items for borrowing';
  $('hero').classList.remove('hidden');
  $('stats').classList.add('hidden');
  $('tableWrap').classList.add('hidden');
  $('cards').classList.remove('hidden');
  document.querySelector('[data-tab="history"]').textContent = 'My history';   // borrowers only see their own
  $('thBorrower').classList.add('hidden');
}
$('signout').onclick = () => { session = null; store.set('ci_session', null); location.href = 'signin.html'; };

let items = store.get('ci_items', []);
const saveItems = () => store.set('ci_items', items);
let catStore = store.get('ci_cats', {});   // custom categories, saved per tab
Object.keys(catStore).forEach(k => catStore[k] = catStore[k].filter(c => c !== 'Other'));

let tab = 'classroom';
const inTab = i => (i.space || 'classroom') === tab;
const DEFAULT_CATS = ['Laptops', 'LEGO Robotics', 'IoT Kits'];
const catsFor = () => catStore[tab] || DEFAULT_CATS;
function fillCats(){
  const list = catsFor(), cur = $('filter').value;
  const opts = list.map(c => `<option>${esc(c)}</option>`).join('');
  $('filter').innerHTML = '<option value="">All categories</option>' + opts;
  $('filter').value = list.includes(cur) ? cur : '';
  $('f-cat').innerHTML = opts;
}
// ----- borrowing (several people can borrow parts of the same item) -----
// item.parts = [{ name, qty }] (optional)   item.loans = [{ id, by, name, state, qty | parts, note, requestedAt, approvedAt, returnRequestedAt }]
// loan state: 'requested' -> 'borrowed' -> 'return-pending' -> (admin verifies) removed
const now = () => new Date().toISOString();
const fmt = iso => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const ACTIVE = ['requested', 'borrowed', 'return-pending'];
const units = i => i.qtyOn === false ? 1 : i.qty;
const slots = i => i.parts && i.parts.length ? i.parts : [{ name: '', qty: units(i) }];
const takenOf = (i, s, states) => (i.loans || []).filter(l => states.includes(l.state))
  .reduce((a, l) => a + ((s.name ? (l.parts || {})[s.name] : l.qty) || 0), 0);
const leftOf = (i, s) => s.qty - takenOf(i, s, ACTIVE);
const canBorrow = i => !['In use', 'Needs repair'].includes(i.status) && slots(i).some(s => leftOf(i, s) > 0);
const loanText = l => (l.whole ? '<b>Entire item</b> · ' : '') + (l.parts
  ? Object.entries(l.parts).filter(([, n]) => n > 0).map(([p, n]) => esc(p) + ' ×' + n).join(', ')
  : 'Qty ' + l.qty);

function syncStatus(i){   // Available / Partly borrowed / Borrowed follows the approved loans
  if (!['Available', 'Partly borrowed', 'Borrowed'].includes(i.status)) return;
  const taken = slots(i).reduce((a, s) => a + takenOf(i, s, ['borrowed', 'return-pending']), 0);
  const total = slots(i).reduce((a, s) => a + s.qty, 0);
  i.status = taken <= 0 ? 'Available' : taken >= total ? 'Borrowed' : 'Partly borrowed';
}

items.forEach(i => {   // upgrade older single-loan items
  if (i.loan) { i.loans = [{ ...i.loan, id: 'm' + i.id, qty: units(i) }]; delete i.loan; }
  if (!i.loans) i.loans = [];
});
saveItems();

// ----- history of finished loans (returned, declined, cancelled) -----
let borrowLog = store.get('ci_history', []);
function logLoan(item, l, outcome){
  borrowLog.push({ item: item.name, cat: item.cat, space: item.space || 'classroom', loan: { ...l }, outcome, endedAt: now() });
  store.set('ci_history', borrowLog);
}

function loanButtons(i, l){
  const b = (act, label, cls) => `<button class="btn ${cls} sm" data-act="${act}" data-id="${i.id}" data-lid="${l.id}">${label}</button>`;
  if (isAdmin) {
    if (l.state === 'requested') return b('approve', 'Approve', '') + b('decline', 'Decline', 'danger');
    if (l.state === 'return-pending') return b('verify', 'Verify return', '');
  } else if (l.by === session) {
    if (l.state === 'requested') return b('cancel', 'Cancel request', 'ghost');
    if (l.state === 'borrowed') return b('return', 'Return', '');
  }
  return '';
}

function statusCell(i){
  let html = `<span class="tag ${i.status.replace(' ', '-')}">${esc(i.status)}</span>`;
  html += `<div class="note">${slots(i).map(s => (s.name ? esc(s.name) : 'Available') + ': ' + leftOf(i, s) + '/' + s.qty).join(' · ')}</div>`;
  (i.loans || []).filter(l => isAdmin || l.by === session).forEach(l => {   // admin sees all, borrower sees own
    const label = { requested: 'Pending approval', borrowed: 'Borrowed', 'return-pending': 'Return pending' }[l.state];
    html += `<div class="loan"><span class="tag ${l.state === 'borrowed' ? 'Borrowed' : 'Pending'}">${label}</span> <b>${isAdmin ? esc(l.name) : 'You'}</b>: ${loanText(l)}`
      + (l.note ? `<div class="note">“${esc(l.note)}”</div>` : '')
      + `<div class="note">Requested: ${fmt(l.requestedAt)}</div>`
      + (l.approvedAt ? `<div class="note">Approved: ${fmt(l.approvedAt)}</div>` : '')
      + (l.returnRequestedAt ? `<div class="note">Return requested: ${fmt(l.returnRequestedAt)}</div>` : '')
      + `<div class="loan-act">${loanButtons(i, l)}</div></div>`;
  });
  return html;
}

function actionButtons(i){
  if (isAdmin) return '<button class="btn ghost sm" data-edit="' + i.id + '">Edit</button><button class="btn danger sm" data-del="' + i.id + '">Delete</button>';
  return canBorrow(i) ? `<button class="btn sm" data-act="borrow" data-id="${i.id}">Borrow</button>` : '';
}

function loanAction(act, item, lid){
  if (!item) return;
  if (act === 'borrow') { if (!isAdmin && canBorrow(item)) openBorrow(item); return; }
  const l = (item.loans || []).find(x => x.id === lid);
  if (!l) return;
  const mine = l.by === session, drop = outcome => { logLoan(item, l, outcome); item.loans = item.loans.filter(x => x !== l); };
  if (!isAdmin && mine && act === 'cancel' && l.state === 'requested') drop('Cancelled');
  else if (!isAdmin && mine && act === 'return' && l.state === 'borrowed') { l.state = 'return-pending'; l.returnRequestedAt = now(); }
  else if (isAdmin && act === 'approve' && l.state === 'requested') { l.state = 'borrowed'; l.approvedAt = now(); }
  else if (isAdmin && act === 'decline' && l.state === 'requested') drop('Declined');
  else if (isAdmin && act === 'verify' && l.state === 'return-pending') drop('Returned');
  else return;
  syncStatus(item); saveItems(); render();
}

// borrower: choose how many / which parts
let borrowItem = null;
function openBorrow(item){
  borrowItem = item;
  $('borrowTitle').textContent = 'Borrow: ' + item.name;
  $('borrowHint').textContent = item.parts && item.parts.length ? 'Choose which parts you need and how many of each.' : 'Choose how many you need.';
  $('borrowFields').innerHTML = slots(item).map((s, n) => {
    const left = leftOf(item, s);
    return `<label for="bf${n}">${s.name ? esc(s.name) : 'Quantity'} <span class="note">(${left} left)</span></label>`
      + `<input id="bf${n}" type="number" min="0" max="${left}" value="${!s.name && left > 0 ? 1 : 0}"${left < 1 ? ' disabled' : ''}>`;
  }).join('');
  const everythingFree = slots(item).every(s => leftOf(item, s) === s.qty);
  const worthIt = slots(item).length > 1 || units(item) > 1;   // not needed for a single unit
  $('borrowAll').innerHTML = worthIt
    ? `<label class="check"><input type="checkbox" id="b-all"${everythingFree ? '' : ' disabled'}> ${item.parts && item.parts.length ? 'Borrow the entire kit' : 'Borrow all ' + units(item)}</label>`
      + (everythingFree ? '' : '<p class="note">Part of this item is already taken, so choose what you need below.</p>')
    : '';
  $('b-note').value = ''; $('b-err').textContent = '';
  $('borrowDlg').showModal();
}
$('borrowAll').onchange = e => {   // "entire kit" fills in everything and locks the fields
  if (e.target.id !== 'b-all') return;
  slots(borrowItem).forEach((s, n) => {
    const left = leftOf(borrowItem, s), box = $('bf' + n);
    box.value = e.target.checked ? left : (!s.name && left > 0 ? 1 : 0);
    box.disabled = e.target.checked || left < 1;
  });
};
$('bCancel').onclick = () => $('borrowDlg').close();
$('borrowForm').onsubmit = e => {
  e.preventDefault();
  const item = borrowItem;
  const loan = { id: Date.now().toString(36), by: session, name: me.name, state: 'requested', requestedAt: now(), note: $('b-note').value.trim() };
  let total = 0;
  slots(item).forEach((s, n) => {
    const v = Math.min(Math.max(0, parseInt($('bf' + n).value) || 0), leftOf(item, s));
    total += v;
    if (s.name) { loan.parts = loan.parts || {}; loan.parts[s.name] = v; } else loan.qty = v;
  });
  if (!total) { $('b-err').textContent = 'Choose at least one.'; return; }
  if ($('b-all') && $('b-all').checked) loan.whole = true;
  (item.loans = item.loans || []).push(loan);
  saveItems(); $('borrowDlg').close(); render();
};

// borrower view: one card per item
function renderCards(list){
  $('cards').innerHTML = list.length ? list.map(i => `<article class="card">
    <span class="cat">${esc(i.cat)}</span>
    <h3>${esc(i.name)}</h3>
    ${i.notes ? `<p class="note">${esc(i.notes)}</p>` : ''}
    <div class="qty">Quantity: ${i.qtyOn === false ? 'N/A' : i.qty}</div>
    <div>${statusCell(i)}</div>
    <div class="card-act">${actionButtons(i)}</div>
  </article>`).join('') : '<div class="empty">No items to show right now.</div>';
}
$('cards').onclick = e => {
  const act = e.target.dataset.act;
  if (act) loanAction(act, items.find(i => i.id === e.target.dataset.id), e.target.dataset.lid);
};

function render(){
  const cats = catsFor();
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('stats').innerHTML = cats.map(c => {
    const n = items.filter(i => inTab(i) && i.cat === c).reduce((a,i) => a + (i.qtyOn === false ? 1 : i.qty), 0);
    return `<div class="stat" data-cat="${esc(c)}" ${isAdmin ? ' title="Right-click to rename or delete"' : ''}><b>${n}</b><small>${esc(c)}</small></div>`;
  }).join('');
  const q = $('q').value.toLowerCase(), f = $('filter').value;
  const list = items.filter(i => inTab(i) && (!f || i.cat === f) && (i.name + ' ' + i.notes).toLowerCase().includes(q));
  if (!isAdmin) { renderCards(list); return; }
  $('rows').innerHTML = list.map(i => `<tr>
    <td><b>${esc(i.name)}</b>${i.notes ? `<div class="note">${esc(i.notes)}</div>` : ''}</td>
    <td>${esc(i.cat)}</td><td>${i.qtyOn === false ? 'N/A' : i.qty}</td>
    <td>${statusCell(i)}</td>
    <td class="act">${actionButtons(i)}</td>
  </tr>`).join('');
  if (isAdmin) {   // tell the admin when requests are waiting
    const n = items.reduce((a, i) => a + (i.loans || []).filter(l => l.state === 'requested' || l.state === 'return-pending').length, 0);
    $('alertBar').textContent = n + (n === 1 ? ' request is' : ' requests are') + ' waiting for your action.';
    $('alertBar').classList.toggle('hidden', !n);
  }
  $('empty').classList.toggle('hidden', list.length > 0);
  $('empty').textContent = items.filter(inTab).length ? 'No items match your search.' : 'No items yet. Select “Add item” to log your first laptop, robot, or kit.';
}
$('q').oninput = $('filter').onchange = render;
document.querySelectorAll('.tab').forEach(b => b.onclick = () => { tab = b.dataset.tab; showView(); });

let editId = null;
function parseParts(){   // "Motor: 4" per line -> [{ name: 'Motor', qty: 4 }]
  return $('f-parts').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const m = l.match(/^(.*?)\s*(?::|×|\sx)\s*(\d+)$/i);
    return m ? { name: m[1].trim(), qty: +m[2] } : { name: l, qty: 1 };
  }).filter(p => p.name);
}
const toggleQty = () => { $('f-qty').disabled = !$('f-qtyon').checked; };
$('f-qtyon').onchange = toggleQty;
function openForm(item){
  editId = item ? item.id : null;
  $('dlgTitle').textContent = item ? 'Edit item' : 'Add item';
  $('f-name').value = item ? item.name : '';
  if (item && ![...$('f-cat').options].some(o => o.value === item.cat)) $('f-cat').add(new Option(item.cat));
  $('f-cat').value = item ? item.cat : catsFor()[0];
  $('f-qty').value = item ? item.qty : 1;
  $('f-qtyon').checked = item ? item.qtyOn !== false : true;
  toggleQty();
  $('f-status').value = item ? item.status : 'Available';
  $('f-notes').value = item ? item.notes : '';
  $('f-parts').value = item && item.parts ? item.parts.map(p => p.name + ': ' + p.qty).join('\n') : '';
  $('dlg').showModal(); $('f-name').focus();
}
$('add').onclick = () => openForm(null);
$('addCat').onclick = () => {
  const name = (prompt('New category name') || '').trim();
  if (!name) return;
  const list = catsFor();
  if (list.some(c => c.toLowerCase() === name.toLowerCase())) { alert('That category already exists.'); return; }
  catStore[tab] = [...list, name];
  store.set('ci_cats', catStore);
  fillCats(); render();
};
$('cancel').onclick = () => $('dlg').close();
$('itemForm').onsubmit = e => {
  e.preventDefault();
  const data = { name: $('f-name').value.trim(), cat: $('f-cat').value, qtyOn: $('f-qtyon').checked, qty: $('f-qtyon').checked ? Math.max(0, parseInt($('f-qty').value) || 0) : 0, status: $('f-status').value, notes: $('f-notes').value.trim(), parts: parseParts() };
  if (editId) Object.assign(items.find(i => i.id === editId), data);
  else items.push({ id: Date.now().toString(36), space: tab, ...data });
  saveItems(); $('dlg').close(); render();
};
$('rows').onclick = e => {
  const act = e.target.dataset.act;
  if (act) { loanAction(act, items.find(i => i.id === e.target.dataset.id), e.target.dataset.lid); return; }
  if (!isAdmin) return;
  const ed = e.target.dataset.edit, del = e.target.dataset.del;
  if (ed) openForm(items.find(i => i.id === ed));
  if (del && confirm('Delete this item? This cannot be undone.')) { items = items.filter(i => i.id !== del); saveItems(); render(); }
};

// right-click menu on the category cards
let menuCat = null;
const hideMenu = () => $('menu').classList.add('hidden');
$('stats').oncontextmenu = e => {
  const card = e.target.closest('.stat');
  if (!card || !isAdmin) return;
  e.preventDefault();
  menuCat = card.dataset.cat;
  $('menu').classList.remove('hidden');
  $('menu').style.left = Math.min(e.clientX, window.innerWidth - 180) + 'px';
  $('menu').style.top = e.clientY + 'px';
};
document.addEventListener('click', hideMenu);
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideMenu(); });

$('menuRename').onclick = () => {
  const old = menuCat;
  const name = (prompt('Rename category', old) || '').trim();
  if (!name || name === old) return;
  const list = catsFor();
  if (list.some(c => c.toLowerCase() === name.toLowerCase())) { alert('That category already exists.'); return; }
  catStore[tab] = list.map(c => c === old ? name : c);
  items.forEach(i => { if (inTab(i) && i.cat === old) i.cat = name; });
  store.set('ci_cats', catStore); saveItems();
  fillCats(); render();
};

$('menuDelete').onclick = () => {
  const n = items.filter(i => inTab(i) && i.cat === menuCat).length;
  if (n) { alert('"' + menuCat + '" still has ' + n + ' item(s). Move or delete them first.'); return; }
  if (!confirm('Delete the category "' + menuCat + '"?')) return;
  catStore[tab] = catsFor().filter(c => c !== menuCat);
  store.set('ci_cats', catStore);
  fillCats(); render();
};

// switch between the inventory tabs, History, and the admin Users tab
function showView(){
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const other = tab === 'users' || tab === 'history';
  $('inv').classList.toggle('hidden', other);
  $('usersView').classList.toggle('hidden', tab !== 'users');
  $('historyView').classList.toggle('hidden', tab !== 'history');
  if (tab === 'users') renderUsers();
  else if (tab === 'history') renderHistory();
  else { fillCats(); render(); }
}

// history: finished loans from the log, plus loans that are still active
function renderHistory(){
  const SPACE = { classroom: 'NextGen Classroom', hub: 'Mobile ICT Hub' };
  const LIVE = { requested: 'Pending approval', borrowed: 'Borrowed', 'return-pending': 'Return pending' };
  const CLS = { Returned: 'Available', Declined: 'Needs-repair', Cancelled: 'Cancelled', Borrowed: 'Borrowed', 'Pending approval': 'Pending', 'Return pending': 'Pending' };
  const rows = borrowLog.map(h => ({ item: h.item, cat: h.cat, space: h.space, loan: h.loan, status: h.outcome, end: h.endedAt }));
  items.forEach(i => (i.loans || []).forEach(l => rows.push({ item: i.name, cat: i.cat, space: i.space || 'classroom', loan: l, status: LIVE[l.state], end: null })));
  const mine = rows.filter(r => isAdmin || r.loan.by === session)
    .sort((a, b) => b.loan.requestedAt.localeCompare(a.loan.requestedAt));
  $('historyRows').innerHTML = mine.length ? mine.map(r => `<tr>
    <td><b>${esc(r.item)}</b><div class="note">${esc(SPACE[r.space] || r.space)} · ${esc(r.cat)}</div></td>
    ${isAdmin ? '<td>' + esc(r.loan.name) + '</td>' : ''}
    <td>${loanText(r.loan)}${r.loan.note ? '<div class="note">“' + esc(r.loan.note) + '”</div>' : ''}</td>
    <td>${fmt(r.loan.requestedAt)}</td>
    <td>${r.loan.approvedAt ? fmt(r.loan.approvedAt) : '—'}</td>
    <td>${r.status === 'Returned' ? fmt(r.end) : '—'}</td>
    <td><span class="tag ${CLS[r.status]}">${r.status}</span></td>
  </tr>`).join('') : '<tr><td colspan="' + (isAdmin ? 7 : 6) + '" class="empty">No borrowing history yet.</td></tr>';
}

// admin: list accounts, change role, delete
function renderUsers(){
  if (!isAdmin) return;   // only admins can see accounts
  $('userRows').innerHTML = users.map(u => {
    const you = u.email === session;
    return `<tr>
      <td><b>${esc(u.name)}</b>${you ? ' <span class="note">(you)</span>' : ''}${u.username ? '<div class="note">@' + esc(u.username) + '</div>' : ''}</td>
      <td>${esc(u.email)}</td>
      <td><select data-role="${esc(u.email)}"${you ? ' disabled' : ''}>
        <option value="admin"${u.role === 'admin' ? ' selected' : ''}>Admin</option>
        <option value="borrower"${u.role !== 'admin' ? ' selected' : ''}>Borrower</option>
      </select></td>
      <td class="act">${you ? '' : '<button class="btn danger sm" data-deluser="' + esc(u.email) + '">Delete</button>'}</td>
    </tr>`;
  }).join('');
}
$('userRows').onchange = e => {
  if (!isAdmin || !e.target.dataset.role) return;
  users.find(u => u.email === e.target.dataset.role).role = e.target.value;
  saveUsers(); renderUsers();
};
$('userRows').onclick = e => {
  const email = e.target.dataset.deluser;
  if (!isAdmin || !email) return;
  if (!confirm('Delete this account? They will no longer be able to sign in.')) return;
  users = users.filter(u => u.email !== email);
  saveUsers(); renderUsers();
};

// start
fillCats();
render();