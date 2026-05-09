(function () {
  var LABELS = {
    "chart-heatmap-from": "Heatmap · from (low)",
    "chart-heatmap-low":  "Heatmap · low-mid",
    "chart-heatmap-mid":  "Heatmap · mid-high",
    "chart-heatmap-to":   "Heatmap · to (high)",
  };
  var DEFAULTS = {
    "chart-heatmap-from": "#3a2a14",
    "chart-heatmap-low":  "#7a5320",
    "chart-heatmap-mid":  "#c08a35",
    "chart-heatmap-to":   "#e8c870",
  };
  var statusEl = function () { return document.getElementById("theme-tokens-status"); };

  function render(tokens) {
    var host = document.getElementById("theme-tokens-rows");
    if (!host) return;
    host.innerHTML = Object.keys(LABELS).map(function (k) {
      var v = tokens[k] || DEFAULTS[k];
      return '<div class="color-row">'
        + '<label>' + LABELS[k] + '</label>'
        + '<input type="color" data-token="' + k + '" value="' + v + '">'
        + '<input type="text" data-hex="' + k + '" value="' + v + '" style="width:90px;font-family:var(--mono);font-size:12px;">'
        + '</div>';
    }).join("");
    host.querySelectorAll('input[type="color"]').forEach(function (inp) {
      inp.addEventListener("input", function () {
        var k = inp.getAttribute("data-token");
        var hex = inp.value;
        var t = host.querySelector('input[data-hex="' + k + '"]');
        if (t) t.value = hex;
        document.documentElement.style.setProperty("--" + k, hex);
      });
    });
    host.querySelectorAll('input[data-hex]').forEach(function (inp) {
      inp.addEventListener("change", function () {
        var k = inp.getAttribute("data-hex");
        var hex = inp.value.trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
        var c = host.querySelector('input[data-token="' + k + '"]');
        if (c) c.value = hex;
        document.documentElement.style.setProperty("--" + k, hex);
      });
    });
  }

  function load() {
    fetch("/api/theme-tokens").then(function (r) { return r.json(); }).then(render);
  }

  window.themeTokensSave = function () {
    var host = document.getElementById("theme-tokens-rows");
    var body = {};
    host.querySelectorAll('input[type="color"]').forEach(function (inp) {
      body[inp.getAttribute("data-token")] = inp.value;
    });
    statusEl().textContent = "Saving…";
    fetch("/api/theme-tokens", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || "Save failed"); });
      statusEl().textContent = "Saved.";
      setTimeout(function () { statusEl().textContent = ""; }, 2000);
    }).catch(function (e) { statusEl().textContent = e.message; });
  };

  window.themeTokensReset = function () {
    render(DEFAULTS);
    Object.keys(DEFAULTS).forEach(function (k) {
      document.documentElement.style.setProperty("--" + k, DEFAULTS[k]);
    });
    statusEl().textContent = "Click Save to persist.";
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
})();
