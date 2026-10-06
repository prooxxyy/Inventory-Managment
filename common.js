// Shared helpers used by every page
const $ = id => document.getElementById(id);

// storage (saved in this browser)
const store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};

let users = store.get('ci_users', []);
let session = store.get('ci_session', null);
// Roles: if nobody is an admin yet, the first account becomes the admin.
// Everyone without a role is a borrower.
if (users.length && !users.some(u => u.role === 'admin')) users[0].role = 'admin';
users.forEach(u => { if (!u.role) u.role = 'borrower'; });
store.set('ci_users', users);
const saveUsers = () => store.set('ci_users', users);
const isSignedIn = () => !!session && users.some(u => u.email === session);

async function hash(s){
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
        return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join(''); }
  catch(e){ return btoa(s); }
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));