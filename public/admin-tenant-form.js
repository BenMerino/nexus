// Tenant editing/creation helpers with branding (logo + color palette)
function esc(s) {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

window.adminTenantForm = {
  renderForm: function (t) {
    var html = '<div class="form-row"><label>Name</label><input id="t-name" value="' + esc(t.name) + '"></div>';
    html += '<div class="form-row"><label>ROR ID</label><input id="t-ror" value="' + esc(t.ror_id || "") + '"></div>';
    html += '<div class="form-row"><label>Public URL Slug</label><input id="t-slug" value="' + esc(t.slug || "") + '" placeholder="e.g. utalca"><div style="font-size:11px;color:#999;margin-top:2px;">Lowercase letters, numbers, hyphens. Empty disables the public page.</div></div>';
    html += '<h4 style="margin:16px 0 8px;">Branding</h4>';
    html += '<div class="branding-grid"><div>';
    html += '<div class="logo-box" id="logo-preview" onclick="document.getElementById(\'t-logo\').click()" title="Click to upload logo">';
    if (t.logo_url) {
      html += '<img src="' + esc(t.logo_url) + '">';
    } else {
      html += '<span style="font-size:11px;color:#999;">No logo</span>';
    }
    html += '</div>';
    html += '<input type="file" id="t-logo" accept="image/*" style="display:none;">';
    html += '<div id="upload-status" style="font-size:11px;width:80px;text-align:center;margin-top:4px;"></div>';
    html += '</div><div>';
    html += '<div class="color-row"><label>Primary Color</label>';
    html += '<input type="color" id="t-primary" value="' + (t.primary_color || "#333333") + '">';
    html += '<span id="primary-hex" style="font-size:11px;color:#999;font-family:monospace;">' + (t.primary_color || "#333333") + '</span></div>';
    html += '<div class="color-row"><label>Secondary Color</label>';
    html += '<input type="color" id="t-secondary" value="' + (t.secondary_color || "#1565c0") + '">';
    html += '<span id="secondary-hex" style="font-size:11px;color:#999;font-family:monospace;">' + (t.secondary_color || "#1565c0") + '</span></div>';
    html += '<div id="color-suggestions" style="margin-top:10px;"></div>';
    html += '</div></div>';
    html += '<button onclick="saveTenant()" style="margin-top:12px;">Save</button>';
    document.getElementById("tenant-form").innerHTML = html;
    bindColorInputs();
    if (t.logo_url) tryExtractColors(t.logo_url);
  },

  renderNewForm: function () {
    var card = document.getElementById("new-tenant-card");
    card.style.display = "block";
    var html = '<h3>New Tenant</h3>' +
      '<div class="form-row"><label>Name</label><input id="nt-name"></div>' +
      '<div class="form-row"><label>ROR ID</label><input id="nt-ror"></div>' +
      '<div class="form-row"><label>Public URL Slug</label><input id="nt-slug" placeholder="e.g. utalca"></div>' +
      '<div class="form-row"><label>Parent Tenant (optional)</label><select id="nt-parent"><option value="">None (top-level)</option>';
    (window._allTenants || []).filter(function (t) { return !t.parent_id; }).forEach(function (t) {
      html += '<option value="' + t.id + '">' + esc(t.name) + '</option>';
    });
    html += '</select></div><button onclick="createNewTenant()" style="margin-top:8px;">Create</button>';
    card.innerHTML = html;
  },

  create: function (callback) {
    var name = document.getElementById("nt-name").value;
    var ror = document.getElementById("nt-ror").value;
    var slug = document.getElementById("nt-slug").value;
    var parentEl = document.getElementById("nt-parent");
    var parentId = parentEl && parentEl.value ? parseInt(parentEl.value) : null;
    if (!name) return alert("Name required");
    if (!ror) return alert("ROR ID is required");
    fetch("/api/auth?action=tenants", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name, ror_id: ror, slug: slug, parent_id: parentId }),
    }).then(r => r.json()).then(function () {
      document.getElementById("new-tenant-card").style.display = "none";
      if (callback) callback();
    });
  },

  save: function (tenant, callback) {
    var fields = {
      id: tenant.id, name: document.getElementById("t-name").value,
      ror_id: document.getElementById("t-ror").value,
      slug: document.getElementById("t-slug").value,
      primary_color: document.getElementById("t-primary").value,
      secondary_color: document.getElementById("t-secondary").value,
    };
    fetch("/api/auth?action=tenants", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    }).then(function () { alert("Saved!"); if (callback) callback(); });
  },

  uploadLogo: function (tenantId, file) {
    var status = document.getElementById("upload-status");
    if (file.size > 512000) { status.textContent = "Max 500KB"; return; }
    status.textContent = "Uploading...";
    var reader = new FileReader();
    reader.onload = function () {
      fetch("/api/auth?action=upload-logo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: reader.result, tenantId: tenantId }),
      }).then(r => r.json()).then(function (d) {
        if (d.ok) {
          status.textContent = "Updated!";
          document.getElementById("logo-preview").innerHTML = '<img src="' + reader.result + '">';
          tryExtractColors(reader.result);
        } else { status.textContent = d.error || "Error"; }
      });
    };
    reader.readAsDataURL(file);
  },
};

function bindColorInputs() {
  var pc = document.getElementById("t-primary");
  var sc = document.getElementById("t-secondary");
  if (pc) pc.addEventListener("input", function (e) { document.getElementById("primary-hex").textContent = e.target.value; });
  if (sc) sc.addEventListener("input", function (e) { document.getElementById("secondary-hex").textContent = e.target.value; });
}

function tryExtractColors(src) {
  if (typeof extractColors !== "function") return;
  extractColors(src, function (colors) {
    var el = document.getElementById("color-suggestions");
    if (!el || !colors || !colors.length) return;
    var html = '<div style="font-size:11px;color:#999;margin-bottom:4px;">Suggested from logo:</div><div style="display:flex;gap:6px;flex-wrap:wrap;">';
    colors.forEach(function (hex) {
      html += '<div style="width:32px;height:32px;background:' + hex + ';border-radius:4px;cursor:pointer;border:2px solid #eee;transition:transform 0.1s;" title="' + hex + '" onclick="pickColor(\'' + hex + '\')" onmouseover="this.style.transform=\'scale(1.15)\'" onmouseout="this.style.transform=\'scale(1)\'"></div>';
    });
    el.innerHTML = html + "</div>";
  });
}

window.pickColor = function (hex) {
  var pc = document.getElementById("t-primary");
  var sc = document.getElementById("t-secondary");
  if (pc.value === "#333333" || pc.value === pc.defaultValue) {
    pc.value = hex; document.getElementById("primary-hex").textContent = hex;
  } else {
    sc.value = hex; document.getElementById("secondary-hex").textContent = hex;
  }
};
