// Admin page logic
(function () {
  var role = null;
  var tenants = [];

  fetch("/api/auth?action=me").then(r => r.json()).then(d => {
    role = d.role;
    if (role !== "superadmin" && role !== "director") {
      document.getElementById("no-access").style.display = "block";
      return;
    }
    document.getElementById("admin-content").style.display = "block";
    loadTenants();
    loadUsers();
    renderUserForm();
  });

  function loadTenants() {
    fetch("/api/auth?action=tenants").then(r => r.json()).then(data => {
      tenants = data;
      var html = "<table><tr><th>ID</th><th>Name</th><th>ROR</th><th>Actions</th></tr>";
      data.forEach(t => {
        html += "<tr><td>" + t.id + "</td><td>" + esc(t.name) + "</td><td>" + esc(t.ror_id || "") + "</td>";
        html += '<td><button onclick="editTenant(' + t.id + ')">Edit</button></td></tr>';
      });
      html += "</table>";
      document.getElementById("tenants-list").innerHTML = html;
    });
  }

  function loadUsers() {
    fetch("/api/auth?action=users").then(r => r.json()).then(data => {
      var html = "<table><tr><th>Username</th><th>Name</th><th>Role</th><th>Tenant</th><th>Active</th></tr>";
      data.forEach(u => {
        var badge = '<span class="badge badge-' + u.role + '">' + u.role + '</span>';
        html += "<tr><td>" + esc(u.username) + "</td><td>" + esc(u.full_name || "") + "</td>";
        html += "<td>" + badge + "</td><td>" + esc(u.tenant_name || "-") + "</td>";
        html += "<td>" + (u.active ? "Yes" : "No") + "</td></tr>";
      });
      html += "</table>";
      document.getElementById("users-list").innerHTML = html;
    });
  }

  window.editTenant = function (id) {
    var t = tenants.find(x => x.id === id);
    if (!t) return;
    document.getElementById("tenant-edit").style.display = "block";
    var html = '<div class="form-row"><label>Name</label><input id="t-name" value="' + esc(t.name) + '"></div>';
    html += '<div class="form-row"><label>ROR ID</label><input id="t-ror" value="' + esc(t.ror_id || "") + '"></div>';
    html += '<div class="color-row"><label>Primary Color</label><input type="color" id="t-primary" value="' + (t.primary_color || "#333333") + '"></div>';
    html += '<div class="color-row"><label>Secondary Color</label><input type="color" id="t-secondary" value="' + (t.secondary_color || "#1565c0") + '"></div>';
    html += '<div class="form-row"><label>Logo</label><input type="file" id="t-logo" accept="image/*"></div>';
    html += '<button onclick="saveTenant(' + id + ')" style="margin-top:8px;">Save</button>';
    document.getElementById("tenant-form").innerHTML = html;
  };

  window.saveTenant = function (id) {
    var fields = {
      id: id,
      name: document.getElementById("t-name").value,
      ror_id: document.getElementById("t-ror").value,
      primary_color: document.getElementById("t-primary").value,
      secondary_color: document.getElementById("t-secondary").value,
    };
    var logoFile = document.getElementById("t-logo").files[0];
    if (logoFile) {
      var reader = new FileReader();
      reader.onload = function () {
        fetch("/api/auth?action=upload-logo", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: reader.result, tenantId: id }),
        }).then(function () { doSaveTenant(fields); });
      };
      reader.readAsDataURL(logoFile);
    } else {
      doSaveTenant(fields);
    }
  };

  function doSaveTenant(fields) {
    fetch("/api/auth?action=tenants", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    }).then(function () { loadTenants(); alert("Saved!"); });
  }

  function renderUserForm() {
    var html = '<div class="form-row"><label>Username</label><input id="u-username"></div>';
    html += '<div class="form-row"><label>Password</label><input id="u-password" type="password"></div>';
    html += '<div class="form-row"><label>Full Name</label><input id="u-name"></div>';
    html += '<div class="form-row"><label>Role</label><select id="u-role"><option>academic</option><option>secretary</option><option>director</option>';
    if (role === "superadmin") html += '<option>superadmin</option>';
    html += '</select></div>';
    html += '<div class="form-row"><label>Position</label><input id="u-position"></div>';
    html += '<div class="form-row"><label>Faculty</label><input id="u-faculty"></div>';
    html += '<button onclick="addUser()" style="margin-top:8px;">Add User</button>';
    document.getElementById("user-form").innerHTML = html;
  }

  window.addUser = function () {
    var body = {
      username: document.getElementById("u-username").value,
      password: document.getElementById("u-password").value,
      full_name: document.getElementById("u-name").value,
      role: document.getElementById("u-role").value,
      position: document.getElementById("u-position").value,
      faculty: document.getElementById("u-faculty").value,
    };
    fetch("/api/auth?action=users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => r.json()).then(d => {
      if (d.ok) { loadUsers(); alert("User created!"); }
      else alert("Error: " + (d.error || "Unknown"));
    });
  };

  function esc(s) {
    if (!s) return "";
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
