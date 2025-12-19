const API_BASE = "http://127.0.0.1:5002";

// ---------- GLOBAL STATE ----------
let currentMode = "isolated";
let isolatedItems = [];
let patchItems = [];
let appItems = [];

// ---------- HELPERS ----------
function byId(id) {
  return document.getElementById(id);
}

function showSection(sectionId) {
  const sections = [
    "isolatedSection",
    "patchSection",
    "appSection",
    "statusSection",
  ];
  sections.forEach((id) => {
    const el = byId(id);
    if (!el) return;
    el.style.display = id === sectionId ? "block" : "none";
  });
}

function setActiveTab(tabId) {
  const tabs = ["tabIsolated", "tabPatch", "tabApp", "tabStatus"];
  tabs.forEach((id) => {
    const btn = byId(id);
    if (!btn) return;
    if (id === tabId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

// Chamado pelos botões do HTML
function setMode(mode) {
  currentMode = mode;

  if (mode === "isolated") {
    setActiveTab("tabIsolated");
    showSection("isolatedSection");
  } else if (mode === "patch") {
    setActiveTab("tabPatch");
    showSection("patchSection");
  } else if (mode === "app") {
    setActiveTab("tabApp");
    showSection("appSection");
  } else if (mode === "status") {
    setActiveTab("tabStatus");
    showSection("statusSection");
  }
}

// ---------- MUNICIPALITIES LOADING ----------
async function loadMunicipalities() {
  // Isolated trees
  try {
    const resp = await fetch(`${API_BASE}/api/municipios`);
    const data = await resp.json();
    const selectIso = byId("isolatedMunicipality");
    if (selectIso && Array.isArray(data.municipios)) {
      selectIso.innerHTML = '<option value="">Selecione o município</option>';
      data.municipios.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        selectIso.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("Erro carregando municípios (isolated):", err);
  }

  // Patch
  try {
    const resp = await fetch(`${API_BASE}/api/patch_municipios`);
    const data = await resp.json();
    const selectPatch = byId("patchMunicipality");
    if (selectPatch && Array.isArray(data.municipios)) {
      selectPatch.innerHTML = '<option value="">Selecione o município</option>';
      data.municipios.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        selectPatch.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("Erro carregando municípios (patch):", err);
  }

  // APP
  try {
    const resp = await fetch(`${API_BASE}/api/app_municipios`);
    const data = await resp.json();
    const selectApp = byId("appMunicipality");
    if (selectApp && Array.isArray(data.municipios)) {
      selectApp.innerHTML = '<option value="">Selecione o município</option>';
      data.municipios.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        selectApp.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("Erro carregando municípios (app):", err);
  }
}

// ---------- ISOLATED TREES ----------
function addItem() {
  const qtyInput = byId("treeQuantity");
  const groupSelect = byId("treeGroup");
  const municipalitySelect = byId("isolatedMunicipality");
  const endangeredSelect = byId("treeEndangered");
  const errorBox = byId("errorBox");
  const table = byId("myTable");

  if (errorBox) errorBox.textContent = "";

  if (!qtyInput || !groupSelect || !municipalitySelect || !endangeredSelect || !table) {
    console.warn("Isolated trees form elements not found.");
    return;
  }

  const qtyStr = qtyInput.value;
  const group = groupSelect.value;
  const municipality = municipalitySelect.value;
  const endangeredValue = endangeredSelect.value;

  if (!qtyStr || Number(qtyStr) <= 0) {
    if (errorBox) errorBox.textContent = "Informe uma quantidade válida.";
    return;
  }
  if (!municipality) {
    if (errorBox) errorBox.textContent = "Selecione um município.";
    return;
  }

  const quantidade = Number(qtyStr);
  const endangered = endangeredValue === "true";

  const item = {
    quantidade: quantidade,
    group: group,
    municipality: municipality,
    endangered: endangered,
  };
  isolatedItems.push(item);

  // Adiciona linha à tabela
  const row = table.insertRow(-1);
  const qtyCell = row.insertCell(0);
  const groupCell = row.insertCell(1);
  const munCell = row.insertCell(2);
  const compPerTreeCell = row.insertCell(3);
  const compTotalCell = row.insertCell(4);
  const delCell = row.insertCell(5);

  qtyCell.textContent = quantidade;
  groupCell.textContent = group;
  munCell.textContent = municipality;
  compPerTreeCell.textContent = "";
  compTotalCell.textContent = "";

  delCell.textContent = "×";
  delCell.classList.add("delete-btn");
  delCell.style.cursor = "pointer";
  delCell.onclick = function () {
    const index = row.rowIndex - 1; // header = 0
    if (index >= 0 && index < isolatedItems.length) {
      isolatedItems.splice(index, 1);
    }
    table.deleteRow(row.rowIndex);
  };

  qtyInput.value = "";
}

async function calculateTotal() {
  const errorBox = byId("errorBox");
  const totalBox = byId("totalBox");
  const table = byId("myTable");

  if (!errorBox || !totalBox || !table) {
    console.warn("Isolated trees elements not found.");
    return;
  }

  // Reset UI
  errorBox.textContent = "";
  totalBox.textContent = "Compensação total do lote: 0";

  if (!Array.isArray(isolatedItems) || isolatedItems.length === 0) {
    errorBox.textContent = "Adicione pelo menos uma entrada antes de calcular.";
    return;
  }

  try {
    const resp = await fetch(`${API_BASE}/api/compensacao/lote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: isolatedItems }),
    });

    const data = await resp.json();
    console.log("Resposta /api/compensacao/lote:", data);
    console.log("Chaves do JSON:", Object.keys(data));

    if (!resp.ok) {
      errorBox.textContent =
        data.erro || data.error || `Erro HTTP ${resp.status} na API.`;
      return;
    }

    // -------- 1) Atualizar linhas na tabela --------
    const processed =
      data["processed items"] ||   // formato antigo
      data.processed_items   ||   // snake_case
      data.itens_processados ||   // pt-BR fallback
      [];

    if (Array.isArray(processed)) {
      processed.forEach((item, idx) => {
        const row = table.rows[idx + 1]; // índice 0 = header
        if (!row) return;

        // colunas: 0=Qtd, 1=Tipo, 2=Município, 3=Tree trade-off, 4=Total item
        if (row.cells[3]) {
          row.cells[3].textContent =
            item.compensacao_por_arvore !== undefined
              ? item.compensacao_por_arvore
              : "";
        }
        if (row.cells[4]) {
          row.cells[4].textContent =
            item.compensacao_total_item !== undefined
              ? item.compensacao_total_item
              : "";
        }
      });
    }

    // -------- 2) Descobrir o campo de total, custe o que custar :) --------
    let total;

    // Tentamos primeiro nomes conhecidos
    const possibleTotalKeys = [
      "total compensation",      // seu formato antigo
      "total_compensation",      // inglês com underscore
      "total_compensacao_geral",
      "total_compensacao_lote",
      "total",
    ];

    for (const key of possibleTotalKeys) {
      if (
        Object.prototype.hasOwnProperty.call(data, key) &&
        data[key] !== null &&
        data[key] !== undefined
      ) {
        total = data[key];
        break;
      }
    }

    // Se ainda não achou, varremos todas as chaves procurando uma numérica com "total" no nome
    if (total === undefined) {
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === "number" && /total/i.test(key)) {
          total = value;
          break;
        }
      }
    }

    // Se mesmo assim nada, cai pra 0
    if (total === undefined) {
      total = 0;
    }

    // Se vier como string, tenta converter
    if (typeof total === "string") {
      const parsed = Number(total);
      if (!Number.isNaN(parsed)) {
        total = parsed;
      }
    }

    totalBox.textContent = `Compensação total do lote: ${total}`;

    // -------- 3) Itens sem regra --------
    const semRegra =
      data["items without compensation"] ||
      data.items_without_compensation ||
      data.itens_sem_regra ||
      [];

    if (Array.isArray(semRegra) && semRegra.length > 0) {
      errorBox.textContent +=
        (errorBox.textContent ? " " : "") +
        "Alguns itens não tiveram regra de compensação.";
    }
  } catch (err) {
    console.error("Erro na requisição /api/compensacao/lote:", err);
    errorBox.textContent = "Erro de conexão com a API.";
  }
}




// ---------- PATCH / AREA ----------
function addPatchItem() {
  const muniSelect = byId("patchMunicipality");
  const areaInput = byId("patchArea");
  const errorBox = byId("errorBoxPatch");
  const table = byId("patchTable").getElementsByTagName("tbody")[0];

  if (errorBox) errorBox.textContent = "";

  if (!muniSelect || !areaInput || !table) {
    console.warn("Patch form elements not found.");
    return;
  }

  const municipality = muniSelect.value;
  const areaStr = areaInput.value;

  if (!municipality) {
    if (errorBox) errorBox.textContent = "Selecione um município.";
    return;
  }
  if (!areaStr || Number(areaStr) <= 0) {
    if (errorBox) errorBox.textContent = "Informe uma área válida.";
    return;
  }

  const area_m2 = Number(areaStr);
  const item = { municipality: municipality, area_m2: area_m2 };
  patchItems.push(item);

  const row = table.insertRow(-1);
  const muniCell = row.insertCell(0);
  const areaCell = row.insertCell(1);
  const compPerM2Cell = row.insertCell(2);
  const compTotalCell = row.insertCell(3);
  const delCell = row.insertCell(4);

  muniCell.textContent = municipality;
  areaCell.textContent = area_m2;
  compPerM2Cell.textContent = "";
  compTotalCell.textContent = "";

  delCell.textContent = "×";
  delCell.classList.add("delete-btn");
  delCell.style.cursor = "pointer";
  delCell.onclick = function () {
    const index = row.rowIndex - 1;
    if (index >= 0 && index < patchItems.length) {
      patchItems.splice(index, 1);
    }
    row.parentNode.removeChild(row);
  };

  areaInput.value = "";
}

async function calculatePatchTotal() {
  const errorBox = byId("errorBoxPatch");
  const totalBox = byId("totalBoxPatch");
  const tableBody = byId("patchTable").getElementsByTagName("tbody")[0];

  if (errorBox) errorBox.textContent = "";
  if (totalBox) totalBox.textContent = "";

  if (!Array.isArray(patchItems) || patchItems.length === 0) {
    if (errorBox) errorBox.textContent = "Adicione pelo menos um patch antes de calcular.";
    return;
  }

  try {
    const resp = await fetch(`${API_BASE}/api/compensacao/patch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patches: patchItems }),
    });

    const data = await resp.json();
    console.log("Resposta /api/compensacao/patch:", data);

    if (!resp.ok) {
      if (errorBox) {
        errorBox.textContent =
          data.erro || data.error || ("Erro HTTP " + resp.status + " na API (patch).");
      }
      return;
    }

    const processed = data.patches_processados || [];

    if (tableBody && Array.isArray(processed)) {
      processed.forEach(function (item, idx) {
        const row = tableBody.rows[idx];
        if (!row) return;

        var compPerM2 = item.compensacao_por_m2;
        if (compPerM2 === undefined || compPerM2 === null) compPerM2 = "";

        var compTotal = item.compensacao_total_patch;
        if (compTotal === undefined || compTotal === null) compTotal = "";

        if (row.cells[2]) row.cells[2].textContent = compPerM2;
        if (row.cells[3]) row.cells[3].textContent = compTotal;
      });
    }

    var total = data.total_compensacao_geral;
    if (total === undefined || total === null) total = 0;
    total = Number(total);
    if ((isNaN(total) || total === 0) && Array.isArray(processed) && processed.length > 0) {
      total = 0;
      processed.forEach(function (it) {
        var v = Number(it.compensacao_total_patch);
        if (!isNaN(v)) total += v;
      });
    }

    if (totalBox) {
      totalBox.textContent = "Compensação total do lote: " + total;
    }

    const semRegra = data.patches_sem_regra || [];
    if (Array.isArray(semRegra) && semRegra.length > 0 && errorBox) {
      errorBox.textContent +=
        (errorBox.textContent ? " " : "") +
        "Alguns patches não tiveram regra de compensação.";
    }
  } catch (err) {
    console.error("Erro na requisição PATCH:", err);
    if (errorBox) errorBox.textContent = "Erro de conexão com a API (patch).";
  }
}

// ---------- SPECIES STATUS ----------
async function consultStatus() {
  const familyInput = byId("statusFamily");
  const specieInput = byId("statusSpecie");
  const messageBox = byId("statusMessage");
  const tableBody = byId("statusTable").getElementsByTagName("tbody")[0];

  if (messageBox) messageBox.textContent = "";
  if (tableBody) tableBody.innerHTML = "";

  const family = familyInput ? familyInput.value.trim() : "";
  const specie = specieInput ? specieInput.value.trim() : "";

  if (!family && !specie) {
    if (messageBox) messageBox.textContent = "Informe ao menos família ou espécie.";
    return;
  }

  const url = new URL(`${API_BASE}/api/species/status`);
  if (family) url.searchParams.append("family", family);
  if (specie) url.searchParams.append("specie", specie);

  try {
    const resp = await fetch(url.toString());
    const data = await resp.json();
    console.log("Resposta /api/species/status:", data);

    if (!resp.ok) {
      if (messageBox) {
        messageBox.textContent =
          data.error || data.erro || ("Erro HTTP " + resp.status + " ao consultar status.");
      }
      return;
    }

    if (!Array.isArray(data) || data.length === 0) {
      if (messageBox) messageBox.textContent = "Espécie não encontrada.";
      return;
    }

    data.forEach(function (item) {
      const row = tableBody.insertRow(-1);
      row.insertCell(0).textContent = item.family || "";
      row.insertCell(1).textContent = item.specie || "";
      row.insertCell(2).textContent = item.status || "";
      row.insertCell(3).textContent = item.descricao || "";
    });
  } catch (err) {
    console.error("Erro ao consultar status:", err);
    if (messageBox) messageBox.textContent = "Erro de conexão com a API.";
  }
}

// ---------- APP ----------
function addAppItem() {
  const muniSelect = byId("appMunicipality");
  const qtyInput = byId("appQuantity");
  const errorBox = byId("errorBoxApp");
  const tableBody = byId("appTable").getElementsByTagName("tbody")[0];

  if (errorBox) errorBox.textContent = "";

  if (!muniSelect || !qtyInput || !tableBody) {
    console.warn("APP form elements not found.");
    return;
  }

  const municipality = muniSelect.value;
  const qtyStr = qtyInput.value;

  if (!municipality) {
    if (errorBox) errorBox.textContent = "Selecione um município.";
    return;
  }
  if (!qtyStr || Number(qtyStr) < 0) {
    if (errorBox) errorBox.textContent = "Informe uma quantidade/área válida.";
    return;
  }

  const quantidade = Number(qtyStr);
  const item = { municipality: municipality, quantidade: quantidade };
  appItems.push(item);

  const row = tableBody.insertRow(-1);
  const muniCell = row.insertCell(0);
  const qtyCell = row.insertCell(1);
  const compUnitCell = row.insertCell(2);
  const compTotalCell = row.insertCell(3);
  const delCell = row.insertCell(4);

  muniCell.textContent = municipality;
  qtyCell.textContent = quantidade;
  compUnitCell.textContent = "";
  compTotalCell.textContent = "";

  delCell.textContent = "×";
  delCell.classList.add("delete-btn");
  delCell.style.cursor = "pointer";
  delCell.onclick = function () {
    const index = row.rowIndex - 1;
    if (index >= 0 && index < appItems.length) {
      appItems.splice(index, 1);
    }
    row.parentNode.removeChild(row);
  };

  qtyInput.value = "";
}

async function calculateAppTotal() {
  const errorBox = byId("errorBoxApp");
  const totalBox = byId("totalBoxApp");
  const tableBody = byId("appTable").getElementsByTagName("tbody")[0];

  if (errorBox) errorBox.textContent = "";
  if (totalBox) totalBox.textContent = "";

  if (!Array.isArray(appItems) || appItems.length === 0) {
    if (errorBox) errorBox.textContent = "Adicione pelo menos uma entrada de APP antes de calcular.";
    return;
  }

  try {
    const resp = await fetch(`${API_BASE}/api/compensacao/app`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apps: appItems }),
    });

    const data = await resp.json();
    console.log("Resposta /api/compensacao/app:", data);

    if (!resp.ok) {
      if (errorBox) {
        errorBox.textContent =
          data.erro || data.error || ("Erro HTTP " + resp.status + " na API (APP).");
      }
      return;
    }

    const processed = data.apps_processados || [];

    if (tableBody && Array.isArray(processed)) {
      processed.forEach(function (item, idx) {
        const row = tableBody.rows[idx];
        if (!row) return;

        var compUnit = item.compensacao_por_unidade;
        if (compUnit === undefined || compUnit === null) compUnit = "";

        var compTotal = item.compensacao_total_app;
        if (compTotal === undefined || compTotal === null) compTotal = "";

        if (row.cells[2]) row.cells[2].textContent = compUnit;
        if (row.cells[3]) row.cells[3].textContent = compTotal;
      });
    }

    var total = data.total_compensacao_geral;
    if (total === undefined || total === null) total = 0;
    total = Number(total);
    if ((isNaN(total) || total === 0) && Array.isArray(processed) && processed.length > 0) {
      total = 0;
      processed.forEach(function (it) {
        var v = Number(it.compensacao_total_app);
        if (!isNaN(v)) total += v;
      });
    }

    if (totalBox) {
      totalBox.textContent = "Compensação total de APP: " + total;
    }

    const semRegra = data.apps_sem_regra || [];
    if (Array.isArray(semRegra) && semRegra.length > 0 && errorBox) {
      errorBox.textContent +=
        (errorBox.textContent ? " " : "") +
        "Alguns itens de APP não tiveram regra de compensação.";
    }
  } catch (err) {
    console.error("Erro na requisição APP:", err);
    if (errorBox) errorBox.textContent = "Erro de conexão com a API.";
  }
}

// ---------- INIT ----------
document.addEventListener("DOMContentLoaded", function () {
  setMode("isolated");
  loadMunicipalities();
});

// expondo para o HTML
window.setMode = setMode;
window.addItem = addItem;
window.calculateTotal = calculateTotal;
window.addPatchItem = addPatchItem;
window.calculatePatchTotal = calculatePatchTotal;
window.consultStatus = consultStatus;
window.addAppItem = addAppItem;
window.calculateAppTotal = calculateAppTotal;
