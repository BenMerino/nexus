// Admin user management helpers
window.adminUsers = {
  loadTenantUsers: function (tid) {
    fetch("/api/auth?action=users&tenantId=" + tid).then(function (r) { return r.json(); }).then(function (data) {
      var html = "<table><tr><th>Username</th><th>Name</th><th>ORCID</th><th>Role</th><th>Active</th></tr>";
      data.forEach(function (u) {
        var badge = '<span class="badge badge-' + u.role + '">' + u.role + '</span>';
        html += "<tr><td>" + esc(u.username) + "</td><td>" + esc(u.full_name || "") + "</td>";
        html += "<td>" + esc(u.orcid || "—") + "</td>";
        html += "<td>" + badge + "</td><td>" + (u.active ? "Yes" : "No") + "</td></tr>";
      });
      html += "</table>";
      document.getElementById("users-list").innerHTML = html;
    });
  },

  renderUserForm: function (tid, role) {
    var html = '<div class="form-row"><label>Username</label><input id="u-username"></div>';
    html += '<div class="form-row"><label>Password</label><input id="u-password" type="password"></div>';
    html += '<div class="form-row"><label>Full Name</label><input id="u-name"></div>';
    html += '<div class="form-row"><label>Role</label><select id="u-role">';
    html += '<option>academic</option><option>secretary</option><option>director</option>';
    if (role === "superadmin") html += '<option>superadmin</option>';
    html += '</select></div>';
    html += '<div class="form-row"><label>ORCID</label><input id="u-orcid" placeholder="https://orcid.org/0000-..."></div>';
    html += '<div class="form-row"><label>Position</label><input id="u-position"></div>';
    html += '<div class="form-row"><label>Faculty</label><input id="u-faculty"></div>';
    html += '<button onclick="addUser()" style="margin-top:8px;">Add User</button>';
    document.getElementById("user-form").innerHTML = html;
    window._userTenantId = tid;
  },

  addUser: function () {
    var body = {
      username: document.getElementById("u-username").value,
      password: document.getElementById("u-password").value,
      full_name: document.getElementById("u-name").value,
      role: document.getElementById("u-role").value,
      orcid: document.getElementById("u-orcid").value,
      position: document.getElementById("u-position").value,
      faculty: document.getElementById("u-faculty").value,
      tenant_id: window._userTenantId,
    };
    fetch("/api/auth?action=users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d.ok) { adminUsers.loadTenantUsers(window._userTenantId); alert("User created!"); }
      else alert("Error: " + (d.error || "Unknown"));
    });
  },
};

window.addUser = adminUsers.addUser;
