(function () {
  var FUNDING_SOURCES = [
    { id: "fondecyt-regular",    name: "Fondecyt Regular",        external: true,  concursable: true,  agency: "ANID" },
    { id: "fondecyt-iniciacion", name: "Fondecyt Iniciación",     external: true,  concursable: true,  agency: "ANID" },
    { id: "fondecyt-postdoc",    name: "Fondecyt Postdoctorado",  external: true,  concursable: true,  agency: "ANID" },
    { id: "fondef",              name: "FONDEF IDeA",             external: true,  concursable: true,  agency: "ANID" },
    { id: "fondap",              name: "FONDAP",                  external: true,  concursable: true,  agency: "ANID" },
    { id: "milenio",             name: "Iniciativa Milenio",      external: true,  concursable: true,  agency: "ANID" },
    { id: "anillos",             name: "Anillos ANID",            external: true,  concursable: true,  agency: "ANID" },
    { id: "corfo",               name: "CORFO",                   external: true,  concursable: true,  agency: "CORFO" },
    { id: "fia",                 name: "FIA",                     external: true,  concursable: true,  agency: "FIA" },
    { id: "vrid",                name: "VRID Interno (UTalca)",   external: false, concursable: true,  agency: "UTalca" },
    { id: "extension",           name: "Extensión / Vinculación", external: false, concursable: false, agency: "UTalca" },
    { id: "contrato-empresa",    name: "Contrato con empresa",    external: true,  concursable: false, agency: "Privado" },
    { id: "consultoria",         name: "Consultoría",             external: true,  concursable: false, agency: "Privado" },
    { id: "otro",                name: "Otro",                    external: false, concursable: false, agency: "—" },
  ];

  function byId(id) {
    for (var i = 0; i < FUNDING_SOURCES.length; i++) if (FUNDING_SOURCES[i].id === id) return FUNDING_SOURCES[i];
    return null;
  }

  function findByName(name) {
    if (!name) return null;
    var lower = String(name).toLowerCase();
    for (var i = 0; i < FUNDING_SOURCES.length; i++) {
      if (FUNDING_SOURCES[i].name.toLowerCase() === lower) return FUNDING_SOURCES[i];
    }
    return null;
  }

  function fmtCLP(n) {
    if (!n) return "$0";
    var num = Number(n);
    if (!Number.isFinite(num)) return "$0";
    return "$" + num.toLocaleString("es-CL");
  }

  window.FUNDING_SOURCES = FUNDING_SOURCES;
  window.fundingById = byId;
  window.fundingByName = findByName;
  window.fmtCLP = fmtCLP;
})();
