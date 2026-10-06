const $ = id => document.getElementById(id);
// storage helpers (private to this browser)
const store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};
let mem = { users: [], items: [], session: null };   // fallback if storage is blocked
let users = store.get('ci_users', mem.users), items = store.get('ci_items', mem.items), session = store.get('ci_session', null);
const saveUsers = () => store.set('ci_users', users);
const saveItems = () => store.set('ci_items', items);
let catStore = store.get('ci_cats', {});   // custom categories, saved per tab
Object.keys(catStore).forEach(k => catStore[k] = catStore[k].filter(c => c !== 'Other'));

async function hash(s){
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
        return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join(''); }
  catch(e){ return btoa(s); }
}
function show(id){ ['signin','signup','dash'].forEach(s => $(s).classList.toggle('hidden', s !== id)); }
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// auth
document.querySelectorAll('[data-go]').forEach(a => {
  const go = () => { $('si-err').textContent = $('su-err').textContent = ''; show(a.dataset.go); };
  a.onclick = go; a.onkeydown = e => { if (e.key === 'Enter') go(); };
});
$('signupForm').onsubmit = async e => {
  e.preventDefault();
  if ($('su-pass').value !== $('su-confirm').value) { $('su-err').textContent = 'Passwords do not match. Retype them and try again.'; return; }
  const email = $('su-email').value.trim().toLowerCase();
  if (users.some(u => u.email === email)) { $('su-err').textContent = 'That email already has an account. Sign in instead.'; return; }
  users.push({ name: $('su-name').value.trim(), email, pass: await hash($('su-pass').value) });
  saveUsers();
  session = email; store.set('ci_session', session);
  e.target.reset(); openDash();
};
$('signinForm').onsubmit = async e => {
  e.preventDefault();
  const email = $('si-email').value.trim().toLowerCase();
  const u = users.find(u => u.email === email);
  if (!u || u.pass !== await hash($('si-pass').value)) { $('si-err').textContent = 'Email or password is incorrect. Check both and try again.'; return; }
  session = email; store.set('ci_session', session);
  e.target.reset(); openDash();
};
$('signout').onclick = () => { session = null; store.set('ci_session', null); show('signin'); };

// dashboard
function openDash(){
  const u = users.find(u => u.email === session);
  if (!u) { show('signin'); return; }
  $('who').textContent = u.name;
  show('dash'); fillCats(); render();
}
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
function render(){
  const cats = catsFor();
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('stats').innerHTML = cats.map(c => {
    const n = items.filter(i => inTab(i) && i.cat === c).reduce((a,i) => a + i.qty, 0);
    return `<div class="stat" data-cat="${esc(c)}" title="Right-click to rename or delete"><b>${n}</b><small>${esc(c)}</small></div>`;
  }).join('');
  const q = $('q').value.toLowerCase(), f = $('filter').value;
  const list = items.filter(i => inTab(i) && (!f || i.cat === f) && (i.name + ' ' + i.notes).toLowerCase().includes(q));
  $('rows').innerHTML = list.map(i => `<tr>
    <td><b>${esc(i.name)}</b>${i.notes ? `<div class="note">${esc(i.notes)}</div>` : ''}</td>
    <td>${esc(i.cat)}</td><td>${i.qtyOn === false ? 'N/A' : i.qty}</td>
    <td><span class="tag ${i.status.replace(' ','-')}">${esc(i.status)}</span></td>
    <td class="act"><button class="btn ghost sm" data-edit="${i.id}">Edit</button><button class="btn danger sm" data-del="${i.id}">Delete</button></td>
  </tr>`).join('');
  $('empty').classList.toggle('hidden', list.length > 0);
  $('empty').textContent = items.filter(inTab).length ? 'No items match your search.' : 'No items yet. Select “Add item” to log your first laptop, robot, or kit.';
}
$('q').oninput = $('filter').onchange = render;
document.querySelectorAll('.tab').forEach(b => b.onclick = () => { tab = b.dataset.tab; fillCats(); render(); });

let editId = null;
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
  const data = { name: $('f-name').value.trim(), cat: $('f-cat').value, qtyOn: $('f-qtyon').checked, qty: $('f-qtyon').checked ? Math.max(0, parseInt($('f-qty').value) || 0) : 0, status: $('f-status').value, notes: $('f-notes').value.trim() };
  if (editId) Object.assign(items.find(i => i.id === editId), data);
  else items.push({ id: Date.now().toString(36), space: tab, ...data });
  saveItems(); $('dlg').close(); render();
};
$('rows').onclick = e => {
  const ed = e.target.dataset.edit, del = e.target.dataset.del;
  if (ed) openForm(items.find(i => i.id === ed));
  if (del && confirm('Delete this item? This cannot be undone.')) { items = items.filter(i => i.id !== del); saveItems(); render(); }
};

// right-click menu on the category cards
let menuCat = null;
const hideMenu = () => $('menu').classList.add('hidden');
$('stats').oncontextmenu = e => {
  const card = e.target.closest('.stat');
  if (!card) return;
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

// start
if (session && users.some(u => u.email === session)) openDash();
else show(users.length ? 'signin' : 'signup');