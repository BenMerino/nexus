// DOI submit embedded in admin tenant detail
(function () {
  var input = document.getElementById("doi-input");
  if (input) input.addEventListener("keydown", function (e) { if (e.key === "Enter") submitDoi(); });

  window.submitDoi = function () {
    var doi = document.getElementById("doi-input").value.trim();
    if (!doi) return;
    var status = document.getElementById("doi-status");
    var results = document.getElementById("doi-results");
    status.innerHTML = '<div class="status loading">Checking DOI across sources...</div>';
    results.innerHTML = "";
    fetch("/api/submit", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doi: doi }),
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (data.error) {
        status.innerHTML = '<div class="status error">Error: ' + esc(data.error) + '</div>';
        return;
      }
      status.innerHTML = '<div class="status success">Stored: ' + esc(data.record?.title || doi) + '</div>';
      if (data.tags && data.tags.length) {
        results.innerHTML = '<div style="margin-top:6px;">' +
          data.tags.map(function (t) { return '<span class="tag ' + esc(t.category) + '">' + esc(t.category) + ': ' + esc(t.value) + '</span>'; }).join(" ") +
          '</div>';
      }
    }).catch(function (err) {
      status.innerHTML = '<div class="status error">' + esc(err.message) + '</div>';
    });
  };
})();
