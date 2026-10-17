// Content scripts can't open the options page themselves.
const portalCookies = async (url) => Object.fromEntries((await chrome.cookies.getAll({ url: new URL(url).origin + '/' })).map((c) => [c.name, c.value]));

// KI-Konto (ISGY Intern MCP server): log in once, then sync notes and the portal session. Token stays in storage.local.
async function aiCall(path, body, token, server) {
  const r = await fetch(server + '/api/ext/' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
async function aiLogin({ email, password, server }) {
  const { status, data } = await aiCall('login', { email, password }, null, server);
  if (status !== 200 || !data.token) return { error: data.error || `Anmeldung fehlgeschlagen (${status}).` };
  await chrome.storage.local.set({ aiAccount: { server, token: data.token, email: data.email }, aiLastSync: 0 });
  return { ok: true, email: data.email };
}
async function aiSync({ session, notes }, sender) {
  const { aiAccount: a } = await chrome.storage.local.get('aiAccount');
  if (!a?.token) return { off: true };
  const body = { notes };
  if (session) body.session = { ...session, c: await portalCookies(sender.url) };
  const { status, data } = await aiCall('sync', body, a.token, a.server).catch((e) => ({ status: 0, data: { error: e.message } }));
  if (status === 401) {
    await chrome.storage.local.set({ aiAccount: { ...a, token: '', error: data.error || 'Abgemeldet.' } });
    return { error: data.error };
  }
  if (status !== 200) return { error: data.error || `Server nicht erreichbar (${status}).` };
  await chrome.storage.local.set({ aiAccount: { ...a, error: '', lastSync: Date.now(), credKind: data.credKind, session: data.session || a.session } });
  return data;
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg === 'open-options') chrome.runtime.openOptionsPage();
  if (msg?.type === 'ai-login') { aiLogin(msg).then(reply, (e) => reply({ error: e.message })); return true; }
  if (msg?.type === 'ai-sync') { aiSync(msg, sender).then(reply, (e) => reply({ error: e.message })); return true; }
  // Portal cookies for the AI connection code; content scripts can't read HttpOnly cookies.
  if (msg === 'portal-cookies') {
    portalCookies(sender.url).then(reply, () => reply({}));
    return true;
  }
});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
