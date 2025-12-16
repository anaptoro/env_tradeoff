// =======================================================
//  Config
// =======================================================
const API_BASE = "http://127.0.0.1:5002";

// árvores isoladas (lote de árvores)
let isolatedItems = [];  // { name, quantidade, group, municipality }

// patches de área (m²)
let patchItems = [];     // { municipality, area_m2 }

// =======================================================
//  Tabs: Isolated vs Patch
// =======================================================
function setMode(mode) {
  const isoSection = document.getElementById("isolatedSection");
  const patchSection = document.getElementById("patchSection");
  const tabIsolated = document.getElementById("tabIsolated");
  const tabPatch = document.getElementById("tabPatch");

  if (mode === "isolated") {
    isoSection.classList.remove("hidden");
    patchSection.classList.add("hidden");
    tabIsolated.classList.add("active");
    tabPatch.classList.remove("active");
  } else {
    isoSection.classList.add("hidden");
    patchSection.classList.remove("hidden");
    tabIsolated.classList.remove("active");
    tabPatch.classList.add("active");
  }
}

// =======================================================
//  Carrega municípios da API e preenche selects
// =======================================================
async function loadMunicipios() {
  const errorBox = document.getElementById("errorBox");
  const errorBoxPatch = document.getElementById("errorBoxPatch");
  const treeMunicipality = document.getElementById("treeMunicipality");
  const patchMunicipality = document.getElementById("patchMunicipality");

  try {
    const resp = await fetch(`${API_BASE}/api/municipios`);
    const text = await resp.text();
    console.log("Resposta /api/municipios:", resp.status, text);

    if (!resp.ok) {
      throw new Error(text || `HTTP ${resp.status}`);
    }

    const data = JSON.parse(text);
    // esperado algo como: { municipios: ["avare", "sorocaba", ...] }
    const municipios = data.municipios || data.municipalities || [];

    // limpa opções atuais (mantém placeholder na posição 0)
    function fillSelect(selectEl) {
      while (selectEl.options.length > 1) {
        selectEl.remove(1);
      }
      municipios.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        selectEl.appendChild(opt);
      });
    }

    fillSelect(treeMunicipality);
    fillSelect(patchMunicipality);

  } catch (err) {
    console.error("Erro ao carregar municípios:", err);
    if (errorBox) errorBox.textContent = "Erro ao carregar municípios da API.";
    if (errorBoxPatch) errorBoxPatch.textContent = "Erro ao carregar municípios da API (patch).";
  }
}

// =======================================================
//  Árvores isoladas: adicionar item
// =======================================================
function addItem() {
  const nameInput = document.getElementById("treeName");
  const qtyInput = document.getElementById("treeQuantity");
  const groupSelect = document.getElementById("treeGroup");
  const municipalitySelect = document.getElementById("treeMunicipality");
  const errorBox = document.getElementById("errorBox");

  errorBox.textContent = "";

  const name = (nameInput.value || "").trim();
  const qtyStr = qtyInput.value;
  const group = groupSelect.value;
  const municipality = municipalitySelect.value;

  if (!name) {
    errorBox.textContent = "Informe o nome da espécie.";
    return;
  }
  if (!qtyStr || Number(qtyStr) <= 0) {
    errorBox.textContent = "Informe uma quantidade válida.";
    return;
  }
  if (!municipality) {
    errorBox.textContent = "Selecione um município.";
    return;
  }

  const quantidade = Number(qtyStr);
  const item = { name, quantidade, group, municipality };
  isolatedItems.push(item);

  // adiciona linha na tabela
  const table = document.getElementById("myTable");
  const row = table.insertRow(-1);

  row.insertCell(0).textContent = name;
  row.insertCell(1).textContent = quantidade;
  row.insertCell(2).textContent = group;
  row.insertCell(3).textContent = municipality;
  row.insertCell(4).textContent = ""; // comp./árvore (preenchido depois)
  row.insertCell(5).textContent = ""; // comp. total item

  const delCell = row.insertCell(6);
  delCell.textContent = "×";
  delCell.classList.add("delete-btn");
  delCell.style.cursor = "pointer";
  delCell.onclick = () => {
    const index = row.rowIndex - 1; // desconta cabeçalho
    isolatedItems.splice(index, 1);
    table.deleteRow(row.rowIndex);
  };

  // limpa inputs
  nameInput.value = "";
  qtyInput.value = "";
}

// =======================================================
//  Árvores isoladas: calcular compensação do lote
// =======================================================
async function calculateTotal() {
  const errorBox = document.getElementById("errorBox");
  const totalBox = document.getElementById("totalBox");

  errorBox.textContent = "";
  totalBox.textContent = "";

  if (!isolatedItems || isolatedItems.length === 0) {
    errorBox.textContent = "Adicione pelo menos uma árvore antes de calcular.";
    return;
  }

  const payload = { items: isolatedItems };

  try {
    const resp = await fetch(`${API_BASE}/api/compensacao/lote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const rawText = await resp.text();
    console.log("Resposta ISOLATED:", resp.status, rawText);

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error("Erro ao fazer JSON.parse (isolated):", e);
      errorBox.textContent =
        "Resposta inválida da API. Veja o console do navegador.";
      return;
    }

    if (!resp.ok) {
      errorBox.textContent =
        data.erro || `Erro HTTP ${resp.status} na API.`;
      return;
    }

    // esperado:
    // {
    //   "itens_processados": [
    //     {
    //       "name": "...",
    //       "quantidade": ...,
    //       "compensacao_por_arvore": 2,
    //       "compensacao_total_item": 4,
    //       ...
    //     }, ...
    //   ],
    //   "itens_sem_regra": [...],
    //   "total_compensacao_geral": 4
    // }

    const tabela = document.getElementById("myTable");
    const linhas = tabela.rows; // 0 = header

    (data.itens_processados || []).forEach((item, idx) => {
      const row = linhas[idx + 1];
      if (!row) return;
      row.cells[4].textContent = item.compensacao_por_arvore;
      row.cells[5].textContent = item.compensacao_total_item;
    });

    totalBox.textContent =
      `Compensação total do lote: ${data.total_compensacao_geral}`;

    if (data.itens_sem_regra && data.itens_sem_regra.length > 0) {
      const nomes = data.itens_sem_regra.map(i => i.name).join(", ");
      errorBox.textContent =
        `Alguns itens não tiveram regra de compensação: ${nomes}.`;
    }

  } catch (err) {
    console.error("Erro na requisição ISOLATED:", err);
    errorBox.textContent = "Erro de conexão com a API.";
  }
}

// =======================================================
//  Patch: adicionar patch
// =======================================================
function addPatchItem() {
  const municipalitySelect = document.getElementById("patchMunicipality");
  const areaInput = document.getElementById("patchArea");
  const errorBoxPatch = document.getElementById("errorBoxPatch");

  errorBoxPatch.textContent = "";

  const municipality = municipalitySelect.value;
  const areaStr = areaInput.value;

  if (!municipality) {
    errorBoxPatch.textContent = "Selecione um município.";
    return;
  }
  if (!areaStr || Number(areaStr) <= 0) {
    errorBoxPatch.textContent = "Informe uma área válida em m².";
    return;
  }

  const area_m2 = Number(areaStr);
  const item = { municipality, area_m2 };
  patchItems.push(item);

  const table = document.getElementById("patchTable");
  const row = table.insertRow(-1);

  row.insertCell(0).textContent = municipality;
  row.insertCell(1).textContent = area_m2;
  row.insertCell(2).textContent = "";  // comp./m²
  row.insertCell(3).textContent = "";  // comp. total patch

  const delCell = row.insertCell(4);
  delCell.textContent = "×";
  delCell.classList.add("delete-btn");
  delCell.style.cursor = "pointer";
  delCell.onclick = () => {
    const index = row.rowIndex - 1; // desconta header
    patchItems.splice(index, 1);
    table.deleteRow(row.rowIndex);
  };

  areaInput.value = "";
}

// =======================================================
//  Patch: calcular compensação dos patches
// =======================================================
async function calculatePatchTotal() {
  const errorBoxPatch = document.getElementById("errorBoxPatch");
  const totalBoxPatch = document.getElementById("totalBoxPatch");

  errorBoxPatch.textContent = "";
  totalBoxPatch.textContent = "";

  if (!patchItems || patchItems.length === 0) {
    errorBoxPatch.textContent = "Adicione pelo menos um patch antes de calcular.";
    return;
  }

  const payload = {
    patches: patchItems.map(item => ({
      municipality: item.municipality,
      area_m2: item.area_m2
    }))
  };

  try {
    // 🔧 important: this must match your Flask route
    const response = await fetch(`${API_BASE}/api/compensacao/patch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const rawText = await response.text();
    console.log("Resposta PATCH:", response.status, rawText);

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error("Erro ao fazer JSON.parse na resposta do PATCH:", e);
      errorBoxPatch.textContent =
        "Resposta inválida da API (patch). Veja o console.";
      return;
    }

    if (!response.ok) {
      errorBoxPatch.textContent =
        data.erro || `Erro HTTP ${response.status} na API (patch).`;
      return;
    }

    // Esperado:
    // {
    //   "patches_processados": [
    //     {
    //       "municipality": "...",
    //       "area_m2": 50,
    //       "compensacao_por_m2": 2,
    //       "compensacao_total_patch": 100
    //     }, ...
    //   ],
    //   "patches_sem_regra": [...],
    //   "total_compensacao_geral": 100
    // }

    const tabela = document.getElementById("patchTable");
    const linhas = tabela.rows;

    (data.patches_processados || []).forEach((item, idx) => {
      const row = linhas[idx + 1];
      if (!row) return;
      row.cells[2].textContent = item.compensacao_por_m2;
      row.cells[3].textContent = item.compensacao_total_patch;
    });

    totalBoxPatch.textContent =
      `Compensação total dos patches: ${data.total_compensacao_geral}`;

    if (data.patches_sem_regra && data.patches_sem_regra.length > 0) {
      const nomes = data.patches_sem_regra.map(p => p.municipality).join(", ");
      errorBoxPatch.textContent =
        `Alguns patches não tiveram regra de compensação: ${nomes}.`;
    }

  } catch (err) {
    console.error("Erro na requisição PATCH:", err);
    errorBoxPatch.textContent = "Erro de conexão com a API (patch).";
  }
}

// =======================================================
//  Expor funções no escopo global (para onclick no HTML)
// =======================================================
window.setMode = setMode;
window.addItem = addItem;
window.calculateTotal = calculateTotal;
window.addPatchItem = addPatchItem;
window.calculatePatchTotal = calculatePatchTotal;

// quando a página carregar, já começa em "isolated" e carrega municípios
window.addEventListener("DOMContentLoaded", () => {
  setMode("isolated");
  loadMunicipios();
});
