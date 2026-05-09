// Extract dominant colors from an image data URL using canvas sampling
function extractColors(dataUrl, callback) {
  if (!dataUrl) { callback([]); return; }
  var img = new Image();
  img.crossOrigin = "anonymous";
  img.onerror = function () { callback([]); };
  img.onload = function () {
    var canvas = document.createElement("canvas");
    var size = 64;
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, size, size);
    var pixels;
    try { pixels = ctx.getImageData(0, 0, size, size).data; }
    catch (e) { console.warn("color-extract: canvas tainted", e); callback([]); return; }

    var buckets = {};
    for (var i = 0; i < pixels.length; i += 4) {
      var r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
      if (a < 100) continue;
      var lum = r * 0.299 + g * 0.587 + b * 0.114;
      if (lum > 240 || lum < 15) continue;
      var qr = Math.round(r / 24) * 24;
      var qg = Math.round(g / 24) * 24;
      var qb = Math.round(b / 24) * 24;
      var key = qr + "," + qg + "," + qb;
      if (!buckets[key]) buckets[key] = { r: 0, g: 0, b: 0, n: 0 };
      buckets[key].r += r;
      buckets[key].g += g;
      buckets[key].b += b;
      buckets[key].n++;
    }

    var sorted = Object.values(buckets).sort(function (a, b) { return b.n - a.n; });
    if (!sorted.length) { callback([]); return; }

    var colors = [];
    for (var j = 0; j < Math.min(sorted.length, 10); j++) {
      var c = sorted[j];
      colors.push(toHex(Math.round(c.r / c.n), Math.round(c.g / c.n), Math.round(c.b / c.n)));
    }

    // Deduplicate similar colors
    var unique = [colors[0]];
    for (var k = 1; k < colors.length; k++) {
      var too_close = false;
      for (var m = 0; m < unique.length; m++) {
        if (cdist(colors[k], unique[m]) < 45) { too_close = true; break; }
      }
      if (!too_close) unique.push(colors[k]);
    }
    callback(unique.slice(0, 5));
  };
  img.src = dataUrl;
}

function toHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function cdist(a, b) {
  var r1 = parseInt(a.slice(1, 3), 16), g1 = parseInt(a.slice(3, 5), 16), b1 = parseInt(a.slice(5, 7), 16);
  var r2 = parseInt(b.slice(1, 3), 16), g2 = parseInt(b.slice(3, 5), 16), b2 = parseInt(b.slice(5, 7), 16);
  return Math.sqrt((r1 - r2) * (r1 - r2) + (g1 - g2) * (g1 - g2) + (b1 - b2) * (b1 - b2));
}
