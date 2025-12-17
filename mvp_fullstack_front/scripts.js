// =======================================================
//  CONFIG & GLOBAL STATE
// =======================================================
const API_BASE = "http://127.0.0.1:5002";

// Isolated trees: { quantidade, group, municipality }
let isolatedItems = [];

// Patch/area: { municipality, area_m2 }
let patchItems = [];

// ================== HELPERS ==================
function byId(id) {
  return document.getElementById(id);
}

function showText(id, msg) {
  const el = byId(id);
  if (!el) return;
  el.textContent = msg || "";
}

// =======================================================
//  TABS: ISOLATED / PATCH / STATUS
// =======================================================
function setMode(mode) {
  const isoSection = byId("isolatedSection");
  const patchSection = byId("patchSection");
  const statusSection = byId("statusSection");

  const tabIsolated = byId("tabIsolated");
  const tabPatch = byId("tabPatch");
  const tabStatus = byId("tabStatus");

  // hide sections
  if (isoSection) isoSection.style.display = "none";
  if (patchSection) patchSection.style.display = "none";
  if (statusSection) statusSection.style.display = "none";

  // remove 'active' from all tabs
  [tabIsolated, tabPatch, tabStatus].forEach((btn) => {
    if (btn) btn.classList.remove("active");
  });

  if (mode === "isolated") {
    if (isoSection) isoSection.style.display = "block";
    if (tabIsolated) tabIsolated.classList.add("active");
  } else if (mode === "patch") {
    if (patchSection) patchSection.style.display = "block";
    if (tabPatch) tabPatch.classList.add("active");
  } else if (mode === "status") {
    if (statusSection) statusSection.style.display = "block";
    if (tabStatus) tabStatus.classList.add("active");
  }
}

// =======================================================
//  MUNICIPALITIES DROPDOWNS (ISOLATED + PATCH)
// =======================================================
async function loadMunicipalities() {
  try {
    const resp = await fetch(`${API_BASE}/api/municipios`);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();

    // Can be ["avare", ...] OR {municipios: [...]} OR {municipalities: [...]}
    let municipios = [];
    if (Array.isArray(data)) {
      municipios = data;
    } else if (Array.isArray(data.municipios)) {
      municipios = data.municipios;
    } else if (Array.isArray(data.municipalities)) {
      municipios = data.municipalities;
    }

    console.log("Municipios recebidos:", municipios);

    const isolatedSelect = byId("isolatedMunicipality");
    const patchSelect = byId("patchMunicipality");

    const fillSelect = (selectEl) => {
      if (!selectEl || !Array.isArray(municipios)) return;

      selectEl.innerHTML = "";
      const opt0 = document.createElement("option");
      opt0.value = "";
      opt0.textContent = "Selecione o município";
      selectEl.appendChild(opt0);

      municipios.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        selectEl.appendChild(opt);
      });
    };

    fillSelect(isolatedSelect);
    fillSelect(patchSelect);
  } catch (err) {
    console.error("Erro ao carregar municípios:", err);
    showText("errorBox", "Erro ao carregar municípios da API.");
    showText("errorBoxPatch", "Erro ao carregar municípios da API (patch).");
  }
}

// =======================================================
//  ISOLATED TREES: ADD ITEM
// =======================================================
function addItem() {
  const qtyInput = byId("treeQuantity");
  const groupSelect = byId("treeGroup");
  const municipalitySelect = byId("isolatedMunicipality");
  const errorBox = byId("errorBox");
  const table = byId("myTable");

  if (errorBox) errorBox.textContent = "";

  if (!qtyInput || !groupSelect || !municipalitySelect || !table) {
    console.warn("Elementos do formulário de árvores isoladas não encontrados.");
    return;
  }

  const qtyStr = qtyInput.value;
  const group = groupSelect.value;
  const municipality = municipalitySelect.value;

  if (!qtyStr || Number(qtyStr) <= 0) {
    if (errorBox) errorBox.textContent = "Informe uma quantidade válida.";
    return;
  }
  if (!municipality) {
    if (errorBox) errorBox.textContent = "Selecione um município.";
    return;
  }

  const quantidade = Number(qtyStr);
  const item = { quantidade, group, municipality };
  isolatedItems.push(item);

  // Add row to table
  const row = table.insertRow(-1);
  // Columns: Quantidade | Tipo | Municipality | Comp./árvore | Comp. total item | delete
  row.insertCell(0).textContent = quantidade;
  row.insertCell(1).textContent = group;
  row.insertCell(2).textContent = municipality;
  row.insertCell(3).textContent = ""; // comp./árvore
  row.insertCell(4).textContent = ""; // comp. total item

  const delCell = row.insertCell(5);
  delCell.textContent = "×";
  delCell.classList.add("delete-btn");
  delCell.style.cursor = "pointer";
  delCell.onclick = () => {
    const index = row.rowIndex - 1; // minus header
    isolatedItems.splice(index, 1);
    table.deleteRow(row.rowIndex);
  };

  qtyInput.value = "";
}

// =======================================================
//  ISOLATED TREES: CALCULATE TOTAL COMPENSATION
// =======================================================
async function calculateTotal() {
  const errorBox = byId("errorBox");
  const totalBox = byId("totalBox");
  const table = byId("myTable");

  if (errorBox) errorBox.textContent = "";
  if (totalBox) totalBox.textContent = "";

  if (!Array.isArray(isolatedItems) || isolatedItems.length === 0) {
    if (errorBox) {
      errorBox.textContent = "Adicione pelo menos uma entrada antes de calcular.";
    }
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

    if (!resp.ok) {
      if (errorBox) {
        errorBox.textContent = data.erro || `Erro HTTP ${resp.status} na API.`;
      }
      return;
    }

    // Atualiza as linhas da tabela com comp./árvore e total por item
    const processed =
      data["processed items"] || // chave que vem do backend
      data.itens_processados ||  // fallback se você mudar no futuro
      [];

    if (table && Array.isArray(processed)) {
      processed.forEach((item, idx) => {
        const row = table.rows[idx + 1]; // 0 é header
        if (!row) return;

        // Índices certos: 3 = Comp./árvore, 4 = Comp. total item
        if (row.cells[3]) row.cells[3].textContent = item.compensacao_por_arvore ?? "";
        if (row.cells[4]) row.cells[4].textContent = item.compensacao_total_item ?? "";
      });
    }

    const total =
      data["total compensation"] ??    // chave atual do backend
      data.total_compensacao_geral ??  // caso mude no futuro
      data.total_compensacao_lote ??
      data.total ??
      0;

    if (totalBox) {
      totalBox.textContent = `Compensação total do lote: ${total}`;
    }

    const semRegra =
      data["items without compensation"] ||
      data.itens_sem_regra ||
      [];

    if (Array.isArray(semRegra) && semRegra.length > 0 && errorBox) {
      errorBox.textContent +=
        (errorBox.textContent ? " " : "") +
        "Alguns itens não tiveram regra de compensação.";
    }

  } catch (err) {
    console.error("Erro na requisição /api/compensacao/lote:", err);
    if (errorBox) errorBox.textContent = "Erro de conexão com a API.";
  }
}

// =======================================================
//  PATCH: ADD PATCH ITEM
// =======================================================
function addPatchItem() {
  const municipalitySelect = byId("patchMunicipality");
  const areaInput = byId("patchArea");
  const errorBoxPatch = byId("errorBoxPatch");
  const table = byId("patchTable");

  if (errorBoxPatch) errorBoxPatch.textContent = "";

  if (!municipalitySelect || !areaInput || !table) {
    console.warn("Elementos de PATCH não encontrados.");
    return;
  }

  const municipality = municipalitySelect.value;
  const areaStr = areaInput.value;

  if (!municipality) {
    if (errorBoxPatch)
      errorBoxPatch.textContent = "Selecione um município para o patch.";
    return;
  }
  if (!areaStr || Number(areaStr) <= 0) {
    if (errorBoxPatch)
      errorBoxPatch.textContent = "Informe uma área válida em m² para o patch.";
    return;
  }

  const area_m2 = Number(areaStr);
  const item = { municipality, area_m2 };
  patchItems.push(item);

  const row = table.insertRow(-1);
  // Columns: municipality | area | comp/m2 | comp total | delete
  row.insertCell(0).textContent = municipality;
  row.insertCell(1).textContent = area_m2;
  row.insertCell(2).textContent = ""; // comp/m²
  row.insertCell(3).textContent = ""; // total

  const delCell = row.insertCell(4);
  delCell.textContent = "×";
  delCell.classList.add("delete-btn");
  delCell.style.cursor = "pointer";
  delCell.onclick = () => {
    const index = row.rowIndex - 1;
    patchItems.splice(index, 1);
    table.deleteRow(row.rowIndex);
  };

  areaInput.value = "";
}

// =======================================================
//  PATCH: CALCULATE COMPENSATION
// =======================================================
async function calculatePatchTotal() {
  const errorBoxPatch = byId("errorBoxPatch");
  const totalBoxPatch = byId("totalBoxPatch");
  const table = byId("patchTable");

  if (errorBoxPatch) errorBoxPatch.textContent = "";
  if (totalBoxPatch) totalBoxPatch.textContent = "";

  if (!patchItems || patchItems.length === 0) {
    if (errorBoxPatch)
      errorBoxPatch.textContent =
        "Adicione pelo menos um patch antes de calcular.";
    return;
  }

  const payload = {
    patches: patchItems.map((p) => ({
      municipality: p.municipality,
      area_m2: p.area_m2,
    })),
  };

  try {
    const resp = await fetch(`${API_BASE}/api/compensacao/patch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const rawText = await resp.text();
    console.log("Resposta PATCH:", resp.status, rawText);

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error("Erro ao fazer JSON.parse (patch):", e);
      if (errorBoxPatch)
        errorBoxPatch.textContent =
          "Resposta inválida da API (patch). Veja o console.";
      return;
    }

    if (!resp.ok) {
      if (errorBoxPatch)
        errorBoxPatch.textContent =
          data.erro || `Erro HTTP ${resp.status} na API (patch).`;
      return;
    }

    if (table && Array.isArray(data.patches_processados)) {
      data.patches_processados.forEach((item, idx) => {
        const row = table.rows[idx + 1];
        if (!row) return;
        row.cells[2].textContent = item.compensacao_por_m2 ?? "";
        row.cells[3].textContent = item.compensacao_total_patch ?? "";
      });
    }

    if (totalBoxPatch) {
      totalBoxPatch.textContent =
        "Compensação total dos patches: " +
        (data.total_compensacao_geral ?? 0);
    }

    if (data.patches_sem_regra && data.patches_sem_regra.length > 0) {
      if (errorBoxPatch)
        errorBoxPatch.textContent +=
          " Alguns patches não tiveram regra de compensação.";
    }
  } catch (err) {
    console.error("Erro na requisição PATCH:", err);
    if (errorBoxPatch)
      errorBoxPatch.textContent = "Erro de conexão com a API (patch).";
  }
}

// =======================================================
//  SPECIES STATUS TAB
// =======================================================
async function searchStatus() {
  const familyInput = byId("statusFamily");
  const specieInput = byId("statusSpecie");
  const table = byId("statusTable");
  const message = byId("statusMessage");

  if (message) message.textContent = "";

  if (!table) {
    console.warn("statusTable não encontrado.");
    return;
  }

  const tbody = table.tBodies[0] || table.createTBody();
  tbody.innerHTML = "";

  const family = familyInput ? familyInput.value.trim() : "";
  const specie = specieInput ? specieInput.value.trim() : "";

  if (!family && !specie) {
    if (message)
      message.textContent =
        "Informe pelo menos família ou espécie para buscar.";
    return;
  }

  try {
    const params = new URLSearchParams();
    if (family) params.append("family", family);
    if (specie) params.append("specie", specie);

    const resp = await fetch(
      `${API_BASE}/api/species-status?` + params.toString()
    );
    if (!resp.ok) {
      if (message) message.textContent = "Espécie não encontrada.";
      return;
    }

    const data = await resp.json();
    const rows = Array.isArray(data) ? data : [data];

    if (!rows.length) {
      tbody.innerHTML =
        "<tr><td colspan='4'>Nenhum resultado encontrado.</td></tr>";
      return;
    }

    rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.family || "-"}</td>
        <td>${row.specie || "-"}</td>
        <td>${row.status || "-"}</td>
        <td>${row.description || row.descricao || "-"}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Erro ao consultar status:", err);
    if (message)
      message.textContent = "Erro ao consultar status na API.";
  }
}

async function consultStatus() {
  const familyInput = document.getElementById("statusFamily");
  const specieInput = document.getElementById("statusSpecie");
  const table       = document.getElementById("statusTable");
  const message     = document.getElementById("statusMessage");

  if (!table) {
    console.warn("statusTable não encontrado.");
    return;
  }

  const tbody = table.tBodies[0] || table.createTBody();
  tbody.innerHTML = "";
  if (message) message.textContent = "";

  const family = familyInput ? familyInput.value.trim() : "";
  const specie = specieInput ? specieInput.value.trim() : "";

  if (!family && !specie) {
    if (message) message.textContent = "Informe família ou espécie para buscar.";
    return;
  }

  const params = new URLSearchParams();
  if (family) params.append("family", family);
  if (specie) params.append("specie", specie);

  try {
    const resp = await fetch(
      `${API_BASE}/api/species/status?` + params.toString()
    );

    if (!resp.ok) {
      if (message) message.textContent = "Erro ao consultar status na API.";
      return;
    }

    const data = await resp.json();   // <- lista de registros

    if (!Array.isArray(data) || data.length === 0) {
      if (message) message.textContent = "Espécie não encontrada.";
      return;
    }

    data.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.family || "-"}</td>
        <td>${row.specie || "-"}</td>
        <td>${row.status || "-"}</td>
        <td>${row.descricao || "-"}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Erro ao consultar status:", err);
    if (message) message.textContent = "Erro de conexão com a API.";
  }
}

// se usar onclick no HTML:
window.consultStatus = consultStatus;

// =======================================================
//  EXPOSE FUNCTIONS FOR HTML
// =======================================================
window.setMode = setMode;
window.addItem = addItem;
window.calculateTotal = calculateTotal;
window.addPatchItem = addPatchItem;
window.calculatePatchTotal = calculatePatchTotal;
window.searchStatus = searchStatus;
window.consultStatus = consultStatus;

// =======================================================
//  PAGE LOAD
// =======================================================
window.addEventListener("DOMContentLoaded", () => {
  console.log("scripts.js carregado - DOM pronto");
  setMode("isolated");   // default tab
  loadMunicipalities();  // fill dropdowns
});
