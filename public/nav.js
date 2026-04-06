// Shared nav: loads user info + tenant logo into the header
(function () {
  if (!document.cookie.includes("nexus_logged_in=1")) return;

  fetch("/api/auth?action=me").then(r => r.json()).then(d => {
    const slot = document.getElementById("nav-user");
    if (!slot) return;

    let html = '<div style="display:flex;align-items:center;gap:8px;">';
    if (d.logo) html += `<img src="${d.logo}" style="height:24px;width:24px;object-fit:contain;border-radius:3px;">`;
    html += `<div style="text-align:right;line-height:1.2;">`;
    html += `<div style="font-size:13px;font-weight:bold;">${esc(d.user)}</div>`;
    html += `<div style="font-size:10px;color:#999;">${esc(d.tenant)}</div>`;
    html += `</div>`;
    html += `<a href="/api/auth?action=logout" style="font-size:12px;margin-left:8px;">Logout</a>`;
    html += `</div>`;
    slot.innerHTML = html;
  }).catch(() => {});

  function esc(s) {
    if (!s) return "";
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
