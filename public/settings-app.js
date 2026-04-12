// Settings page: logo upload + color customization
(function () {
  var tenantId = null;

  fetch("/api/auth?action=me").then(function (r) { return r.json(); }).then(function (d) {
    tenantId = d.tenantId;
    document.getElementById("branding-title").textContent = (d.tenant || "University") + " Branding";
    if (d.logo) showPreview(d.logo);
    if (d.primaryColor) {
      document.getElementById("primary-color").value = d.primaryColor;
      document.getElementById("primary-hex").textContent = d.primaryColor;
    }
    if (d.secondaryColor) {
      document.getElementById("secondary-color").value = d.secondaryColor;
      document.getElementById("secondary-hex").textContent = d.secondaryColor;
    }
  });

  document.getElementById("primary-color").addEventListener("input", function (e) {
    document.getElementById("primary-hex").textContent = e.target.value;
  });
  document.getElementById("secondary-color").addEventListener("input", function (e) {
    document.getElementById("secondary-hex").textContent = e.target.value;
  });

  function showPreview(src) {
    document.getElementById("logo-preview").innerHTML =
      '<img src="' + src + '" style="max-width:80px;max-height:80px;object-fit:contain;">';
    if (typeof extractColors === "function") {
      extractColors(src, function (colors) { renderSwatches(colors); });
    }
  }

  function renderSwatches(colors) {
    var el = document.getElementById("color-suggestions");
    if (!el) return;
    if (!colors || !colors.length) {
      el.innerHTML = '<div style="font-size:11px;color:#999;">No colors extracted from logo.</div>';
      return;
    }
    var html = '<div style="font-size:11px;color:#999;margin-bottom:4px;">Suggested from logo (click to apply):</div><div style="display:flex;gap:6px;flex-wrap:wrap;">';
    colors.forEach(function (hex) {
      html += '<div style="width:32px;height:32px;background:' + hex + ';border-radius:4px;cursor:pointer;border:2px solid #eee;transition:transform 0.1s;" title="' + hex + '" onclick="pickColor(\'' + hex + '\')" onmouseover="this.style.transform=\'scale(1.15)\'" onmouseout="this.style.transform=\'scale(1)\'"></div>';
    });
    html += "</div>";
    el.innerHTML = html;
  }

  window.pickColor = function (hex) {
    var pc = document.getElementById("primary-color");
    var sc = document.getElementById("secondary-color");
    if (pc.value === "#333333" || pc.value === pc.defaultValue) {
      pc.value = hex;
      document.getElementById("primary-hex").textContent = hex;
    } else {
      sc.value = hex;
      document.getElementById("secondary-hex").textContent = hex;
    }
  };

  document.getElementById("logo-input").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var status = document.getElementById("upload-status");
    if (file.size > 512000) { status.textContent = "Max 500KB"; return; }
    status.textContent = "Uploading...";
    var reader = new FileReader();
    reader.onload = function () {
      fetch("/api/auth?action=upload-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: reader.result, tenantId: tenantId }),
      }).then(function (r) { return r.json(); }).then(function (result) {
        if (result.ok) { status.textContent = "Updated!"; showPreview(reader.result); }
        else status.textContent = result.error;
      }).catch(function (err) { status.textContent = err.message; });
    };
    reader.readAsDataURL(file);
  });

  window.saveColors = function () {
    var status = document.getElementById("color-status");
    var body = {
      id: tenantId,
      primary_color: document.getElementById("primary-color").value,
      secondary_color: document.getElementById("secondary-color").value,
    };
    fetch("/api/auth?action=tenants", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (r) { return r.json(); }).then(function (d) {
      status.textContent = d.ok ? "Saved!" : (d.error || "Error");
      setTimeout(function () { status.textContent = ""; }, 2000);
    }).catch(function (err) { status.textContent = err.message; });
  };
})();
