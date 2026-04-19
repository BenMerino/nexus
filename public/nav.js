// Shared nav: loads user info + tenant logo into the header
(function () {
  if (!document.cookie.includes("nexus_logged_in=1")) return;

  var slot = document.getElementById("nav-user");
  if (!slot) return;

  function esc(s) {
    if (!s) return "";
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  var currentData = null;

  function renderLogo(d) {
    var logoSlot = document.querySelector("nav .logo");
    if (!logoSlot) return;
    if (!d.logo || d.role === "superadmin") {
      logoSlot.textContent = "Nexus";
      return;
    }
    logoSlot.innerHTML = '<img src="' + d.logo + '" style="height:36px;object-fit:contain;">';
  }

  function render(d) {
    currentData = d;
    renderLogo(d);
    var html = '<div style="display:flex;align-items:center;gap:8px;">';
    html += '<div id="nav-avatar" style="display:flex;align-items:center;gap:8px;cursor:pointer;">';
    var p = d.profile || {};
    var displayName = p.name || d.user;
    var subParts = [p.position, p.faculty, d.tenant].filter(Boolean);
    html += '<div style="text-align:right;line-height:1.2;">';
    html += '<div style="font-size:13px;font-weight:bold;">' + esc(displayName) + '</div>';
    html += '<div style="font-size:10px;color:#999;">' + subParts.map(esc).join(" · ") + '</div>';
    if (d.hIndex != null) {
      html += '<div style="font-size:10px;color:#1565c0;font-weight:bold;">H-index: ' + d.hIndex + '</div>';
    }
    html += '</div></div>';
    html += '<a href="/api/auth?action=logout" style="font-size:12px;margin-left:8px;">Logout</a>';
    html += '</div>';
    slot.innerHTML = html;
    document.getElementById("nav-avatar").addEventListener("click", showProfile);
  }

  function showProfile() {
    if (document.getElementById("profile-popup")) return;
    var p = currentData && currentData.profile;
    if (!p) return;

    var overlay = document.createElement("div");
    overlay.id = "profile-popup";
    overlay.className = "profile-overlay";

    var card = '<div class="profile-card">';
    card += '<div class="profile-header">';
    if (currentData.logo) card += '<img src="' + currentData.logo + '" class="profile-logo">';
    card += '<div class="profile-name">' + esc(p.name) + '</div>';
    if (p.titles && p.titles.length) {
      card += '<div class="profile-titles">' + p.titles.map(esc).join(", ") + '</div>';
    }
    card += '</div>';
    card += '<table class="profile-table">';
    card += '<tr><td>ORCID</td><td>' + (p.orcid ? esc(p.orcid) : '<span style="color:#999;">—</span>') + '</td></tr>';
    if (currentData.userPapers != null) card += '<tr><td>My Papers</td><td>' + currentData.userPapers + '</td></tr>';
    card += '<tr><td>Position</td><td>' + esc(p.position) + '</td></tr>';
    card += '<tr><td>Faculty</td><td>' + esc(p.faculty) + '</td></tr>';
    card += '<tr><td>Affiliation</td><td>' + esc(p.affiliation) + '</td></tr>';
    card += '<tr><td>ROR</td><td>' + (p.ror ? esc(p.ror) : '<span style="color:#999;">—</span>') + '</td></tr>';
    if (currentData.tenantPapers != null) card += '<tr><td>Institutional Papers</td><td>' + currentData.tenantPapers + '</td></tr>';
    card += '</table>';
    card += '<button class="profile-close">Close</button>';
    card += '</div>';
    overlay.innerHTML = card;
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay || e.target.classList.contains("profile-close")) {
        overlay.remove();
      }
    });
  }

  var SUPERADMIN_LINKS = [
    ["/admin.html", "Admin"],
  ];
  var DEFAULT_LINKS = [
    ["/dashboard.html", "Dashboard"], ["/overview.html", "Overview"],
    ["/explore.html", "Explore"], ["/tag-manager.html", "Tags"],
  ];

  function buildNav(role) {
    var linksSlot = document.getElementById("nav-links");
    if (!linksSlot) return;
    var links = role === "superadmin" ? SUPERADMIN_LINKS : DEFAULT_LINKS;
    var html = "";
    links.forEach(function (l) {
      var cls = location.pathname === l[0] ? ' class="active"' : "";
      html += '<a href="' + l[0] + '"' + cls + '>' + l[1] + '</a>';
    });
    linksSlot.innerHTML = html;
  }

  // Render immediately from cache to prevent jitter
  var cached = localStorage.getItem("nexus_nav");
  if (cached) { try { var c = JSON.parse(cached); buildNav(c.role); renderLogo(c); render(c); } catch (e) {} }

  // Then refresh from API and update cache
  fetch("/api/auth?action=me")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      localStorage.setItem("nexus_nav", JSON.stringify(d));
      buildNav(d.role);
      render(d);
    }).catch(function () {});
})();
