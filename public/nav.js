// Shared nav: loads user info + tenant logo into the header
(function () {
  if (!document.cookie.includes("nexus_logged_in=1")) return;

  var slot = document.getElementById("nav-user");
  if (!slot) return;

  function esc(s) {
    if (!s) return "";
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function render(d) {
    var html = '<div style="display:flex;align-items:center;gap:8px;">';
    if (d.logo) html += '<img src="' + d.logo + '" style="height:24px;width:24px;object-fit:contain;border-radius:3px;">';
    html += '<div style="text-align:right;line-height:1.2;">';
    html += '<div style="font-size:13px;font-weight:bold;">' + esc(d.user) + '</div>';
    html += '<div style="font-size:10px;color:#999;">' + esc(d.tenant) + '</div>';
    if (d.hIndex != null) {
      html += '<div style="font-size:10px;color:#1565c0;font-weight:bold;">H-index: ' + d.hIndex + '</div>';
    }
    html += '</div>';
    html += '<a href="/api/auth?action=logout" style="font-size:12px;margin-left:8px;">Logout</a>';
    html += '</div>';
    slot.innerHTML = html;
  }

  // Render immediately from cache to prevent jitter
  var cached = localStorage.getItem("nexus_nav");
  if (cached) { try { render(JSON.parse(cached)); } catch (e) {} }

  // Then refresh from API and update cache
  Promise.all([
    fetch("/api/auth?action=me").then(function (r) { return r.json(); }),
    fetch("/api/h-index").then(function (r) { return r.json(); }).catch(function () { return {}; }),
  ]).then(function (results) {
    var d = results[0];
    if (results[1].collectionHIndex != null) d.hIndex = results[1].collectionHIndex;
    localStorage.setItem("nexus_nav", JSON.stringify(d));
    render(d);
  }).catch(function () {});
})();
