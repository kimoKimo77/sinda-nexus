const $ = (id) => document.getElementById(id);
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function say(message, bad = false) { $('message').textContent = message; $('message').style.color = bad ? '#ff9b9b' : '#6dd9c6'; }
function short(address) { return address.slice(0, 10) + '…' + address.slice(-8); }
async function loadWallets() {
  const { items } = await api('/api/wallets');
  $('wallet-count').textContent = String(items.length);
  const list = $('wallet-list');
  list.replaceChildren();
  if (!items.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'لا توجد محافظ مضافة بعد.'; list.append(p); return; }
  for (const item of items) {
    const row = document.createElement('article'); row.className = 'wallet';
    const info = document.createElement('div');
    const name = document.createElement('small'); name.textContent = item.label || 'محفظة بدون اسم';
    const address = document.createElement('strong'); address.textContent = item.address; address.title = item.address;
    info.append(name, address);
    const actions = document.createElement('div'); actions.className = 'wallet-actions';
    const copy = document.createElement('button'); copy.className = 'secondary'; copy.textContent = 'نسخ العنوان'; copy.addEventListener('click', async () => { await navigator.clipboard.writeText(item.address); say('تم نسخ العنوان.'); });
    const balance = document.createElement('button'); balance.textContent = 'فحص ETH'; balance.addEventListener('click', async () => {
      try { const result = await api(`/api/wallets/${item.address}/balance?chainid=1`); say(`الرصيد بوحدة Wei: ${result.balanceWei}`); }
      catch (error) { say(error.message, true); }
    });
    const remove = document.createElement('button'); remove.className = 'danger'; remove.textContent = 'حذف'; remove.addEventListener('click', async () => { await api(`/api/wallets/${item.address}`, { method: 'DELETE' }); await loadWallets(); say('تم حذف العنوان من القائمة.'); });
    actions.append(copy, balance, remove); row.append(info, actions); list.append(row);
  }
}
$('wallet-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/wallets', { method: 'POST', body: JSON.stringify({ label: $('label').value, address: $('address').value.trim() }) });
    $('address').value = ''; $('label').value = ''; await loadWallets(); say('تمت إضافة العنوان.');
  } catch (error) { say(error.message, true); }
});
$('refresh').addEventListener('click', () => loadWallets().catch((error) => say(error.message, true)));
api('/api/health').then((data) => { $('health').textContent = data.status === 'ok' ? 'متصل' : 'غير متاح'; }).catch(() => { $('health').textContent = 'غير متاح'; });
loadWallets().catch((error) => say(error.message, true));
