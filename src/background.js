// Content scripts can't open the options page themselves.
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg === 'open-options') chrome.runtime.openOptionsPage();
  // Portal cookies for the AI connection code; content scripts can't read HttpOnly cookies.
  if (msg === 'portal-cookies') {
    chrome.cookies.getAll({ url: new URL(sender.url).origin + '/' })
      .then((cs) => reply(Object.fromEntries(cs.map((c) => [c.name, c.value]))), () => reply({}));
    return true;
  }
});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
