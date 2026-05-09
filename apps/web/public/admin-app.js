// Admin page — tenant-first navigation for superadmin
(function () {
  var role = null, tenants = [], activeTenant = null;

  fetch("/api/auth?action=me").then(r => r.json()).then(function (d) {
    role = d.role;
    if (role !== "superadmin") {
      document.getElementById("no-access").style.display = "block";
      return;
    }
    document.getElementById("tenant-overview").style.display = "block";
    loadTenants();
  }).catch(function (err) { console.error("Admin init error:", err); });

  document.getElementById("btn-back").onclick = function () {
    activeTenant = null;
    document.getElementById("tenant-detail").style.display = "none";
    document.getElementById("tenant-overview").style.display = "block";
    loadTenants();
  };

  document.getElementById("btn-new-tenant").onclick = function () {
    adminTenantForm.renderNewForm();
  };

  window.createNewTenant = function () {
    adminTenantForm.create(loadTenants);
  };

  window.saveTenant = function () {
    if (!activeTenant) return;
    adminTenantForm.save(activeTenant);
  };

  function loadTenants() {
    Promise.all([
      fetch("/api/auth?action=tenants").then(r => r.json()),
      fetch("/api/auth?action=users").then(r => r.json()),
    ]).then(function (results) {
      tenants = results[0];
      window._allTenants = tenants;
      var allUsers = results[1];
      var counts = {};
      allUsers.forEach(function (u) { counts[u.tenant_id] = (counts[u.tenant_id] || 0) + 1; });
      var parents = tenants.filter(function (t) { return !t.parent_id; });
      var html = "<table><tr><th>Name</th><th>ROR</th><th>Users</th><th></th></tr>";
      parents.forEach(function (t) {
        html += "<tr><td><strong>" + esc(t.name) + "</strong></td>";
        html += "<td>" + esc(t.ror_id || "\u2014") + "</td>";
        html += "<td>" + (counts[t.id] || 0) + "</td>";
        html += '<td><button onclick="openTenant(' + t.id + ')">Manage</button></td></tr>';
        var subs = tenants.filter(function (s) { return s.parent_id === t.id; });
        subs.forEach(function (s) {
          html += '<tr style="background:#f9f9f9;"><td style="padding-left:28px;">&mdash; ' + esc(s.name) + "</td>";
          html += "<td>" + esc(s.ror_id || "\u2014") + "</td>";
          html += "<td>" + (counts[s.id] || 0) + "</td>";
          html += '<td><button onclick="openTenant(' + s.id + ')">Manage</button></td></tr>';
        });
      });
      html += "</table>";
      document.getElementById("tenants-grid").innerHTML = html;
    });
  }

  window.openTenant = function (id) {
    activeTenant = tenants.find(function (t) { return t.id === id; });
    if (!activeTenant) return;
    document.getElementById("tenant-overview").style.display = "none";
    document.getElementById("tenant-detail").style.display = "block";
    var parent = activeTenant.parent_id ? tenants.find(function (p) { return p.id === activeTenant.parent_id; }) : null;
    var title = parent ? parent.name + " / " + activeTenant.name : activeTenant.name;
    document.getElementById("detail-title").textContent = title;
    loadTenantUsers(id);
    loadSubtenants(id);
    adminTenantForm.renderForm(activeTenant);
    document.getElementById("t-logo").addEventListener("change", function (e) {
      if (e.target.files[0] && activeTenant) adminTenantForm.uploadLogo(activeTenant.id, e.target.files[0]);
    });
    document.getElementById("btn-institution-import").onclick = function () {
      if (!activeTenant || !activeTenant.ror_id) { alert("This tenant has no ROR ID configured."); return; }
      startInstitutionImport(activeTenant.ror_id);
    };
    renderUserForm(id);
  };

  function loadSubtenants(parentId) {
    var subs = tenants.filter(function (t) { return t.parent_id === parentId; });
    var el = document.getElementById("subtenants-list");
    if (!subs.length) { el.innerHTML = '<p style="color:#999;font-size:12px;">No subtenants yet.</p>'; return; }
    var html = "<table><tr><th>Name</th><th>ROR</th><th></th></tr>";
    subs.forEach(function (s) {
      html += "<tr><td>" + esc(s.name) + "</td><td>" + esc(s.ror_id || "\u2014") + "</td>";
      html += '<td><button onclick="openTenant(' + s.id + ')">Manage</button></td></tr>';
    });
    el.innerHTML = html + "</table>";
  }

  window.addSubtenant = function () {
    if (!activeTenant) return;
    var name = document.getElementById("st-name").value;
    var ror = document.getElementById("st-ror").value;
    if (!name) return alert("Name required");
    fetch("/api/auth?action=tenants", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name, ror_id: ror, parent_id: activeTenant.id }),
    }).then(r => r.json()).then(function () {
      document.getElementById("st-name").value = "";
      document.getElementById("st-ror").value = "";
      fetch("/api/auth?action=tenants").then(r => r.json()).then(function (data) {
        tenants = data;
        loadSubtenants(activeTenant.id);
      });
    });
  };

  function loadTenantUsers(tid) { adminUsers.loadTenantUsers(tid); }
  function renderUserForm(tid) { adminUsers.renderUserForm(tid, role); }
})();
