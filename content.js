(function () {
  const host = location.hostname.replace(/^www\./, "");

  const isTarget =
    /(^|\.)instagram\.com$/.test(host) ||
    /(^|\.)roblox\.com$/.test(host);

  if (!isTarget) return;

  // Let background handle dedupe / cookie pull
  chrome.runtime.sendMessage({ type: "page_loaded", domain: host });
})();
