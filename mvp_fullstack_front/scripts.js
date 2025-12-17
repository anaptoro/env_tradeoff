// =======================================================
//  Config
// =======================================================
const API_BASE = "http://127.0.0.1:5002";   // mesma porta do Flask

// árvores isoladas (lote de árvores)
let isolatedItems = [];  // { name, quantidade, group, municipality }

// patches de área (m²)
let patchItems = [];     // { municipality, area_m2 }

console.log("scripts.js loaded");

// =======================================================
//  Tabs: Isolated vs Patch
// =======================================================
function setMode(mode) {
  const isoSection = document.getElementById("isolatedSection");
  const patchSection = document.getElementById("patchSection");
  const tabIsolated = document.getElementById("tabIsolated");
  const tabPatch = document.getElementById("tabPatch");

  // se não existir (por segurança), não quebra nada
  if (!isoSection || !patchSection || !tabIsolated || !tabPatch) {
    console.warn("Elementos de abas não encontrados, pulando setMode");
    return;
  }

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
    const municipios = data.municipios || data.municipalities || [];

    function fillSelect(selectEl) {
      if (!selectEl) return;
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
  console.log("addItem() chamado (isolated)");

  const qtyInput = document.getElementById("treeQuantity");
  const groupSelect = document.getElementById("treeGroup");
  const municipalitySelect = document.getElementById("treeMunicipality");
  const errorBox = document.getElementById("errorBox");

  if (!qtyInput || !groupSelect || !municipalitySelect) {
    console.warn("Inputs de árvores isoladas não encontrados.");
    return;
  }

  errorBox.textContent = "";

  const qtyStr = qtyInput.value;
  const group = groupSelect.value;
  const municipality = municipalitySelect.value;

  if (!qtyStr || Number(qtyStr) <= 0) {
    errorBox.textContent = "Informe uma quantidade válida.";
    return;
  }
  if (!municipality) {
    errorBox.textContent = "Selecione um município.";
    return;
  }

  const quantidade = Number(qtyStr);

  // EXATAMENTE o formato do Postman
  const item = { group, municipality, quantidade };
  isolatedItems.push(item);

  const table = document.getElementById("myTable");
  const row = table.insertRow(-1);

  // colunas: Quantidade | Tipo | Municipality | Comp./árvore | Comp. total item | [X]
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
    const index = row.rowIndex - 1; // desconta cabeçalho
    isolatedItems.splice(index, 1);
    table.deleteRow(row.rowIndex);
  };

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
    errorBox.textContent = "Adicione pelo menos um item na lista.";
    return;
  }

  try {
    const resp = await fetch("http://127.0.0.1:5002/api/compensacao/lote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: isolatedItems }),
    });

    if (!resp.ok) {
      console.error("Erro HTTP (isolated):", resp.status);
      errorBox.textContent = "Erro ao conectar com a API (isolated).";
      return;
    }

    const data = await resp.json();
    console.log("Resposta API (isolated):", data);

    const tabela = document.getElementById("myTable");
    const linhas = tabela.rows;

    // usa os nomes com espaços do JSON
    const processed =
      data["processed items"] ||
      data.itens_processados || [];

    let totalLote = 0;

    processed.forEach((item, idx) => {
      const row = linhas[idx + 1]; // pula cabeçalho
      if (!row) return;

      const perTree = Number(
        item.compensacao_por_arvore ??
        item.compensacao_por_item ??
        0
      );
      const totalItem = Number(
        item.compensacao_total_item ??
        item.total_compensacao ??
        0
      );

      // 0: Quantidade  1: Tipo  2: Municipality  3: Comp./árvore  4: Comp. total item  5: [X]
      row.cells[3].textContent = perTree || "-";
      row.cells[4].textContent = totalItem || "-";

      totalLote += totalItem;
    });

    // se vier o total da API, ok; senão usamos o somado
    const totalFromApi =
      data["total compensation"] ??
      data.total_compensacao_geral ??
      totalLote;

    totalBox.textContent =
      `Compensação total do lote: ${totalFromApi}`;

    const semRegra =
      data["items without compensation"] ||
      data.itens_sem_regra ||
      [];

    if (semRegra.length > 0) {
      errorBox.textContent =
        "Alguns itens não foram compensados.";
    }
  } catch (err) {
    console.error("Erro fetch isolated:", err);
    errorBox.textContent = "Erro de conexão com a API (isolated).";
  }
}



// =======================================================
//  Patch: adicionar patch
// =======================================================
function addPatchItem() {
  console.log("addPatchItem() chamado");
  const municipalitySelect = document.getElementById("patchMunicipality");
  const areaInput = document.getElementById("patchArea");
  const errorBoxPatch = document.getElementById("errorBoxPatch");

  if (!municipalitySelect || !areaInput) {
    console.warn("Inputs de patch não encontrados.");
    return;
  }

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
    const index = row.rowIndex - 1;
    patchItems.splice(index, 1);
    table.deleteRow(row.rowIndex);
  };

  areaInput.value = "";
}

// =======================================================
//  Patch: calcular compensação dos patches
// =======================================================
async function calculatePatchTotal() {
  console.log("calculatePatchTotal() chamado");
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
      console.error("Erro ao fazer JSON.parse (patch):", e);
      errorBoxPatch.textContent =
        "Resposta inválida da API (patch). Veja o console.";
      return;
    }

    if (!response.ok) {
      errorBoxPatch.textContent =
        data.erro || `Erro HTTP ${response.status} na API (patch).`;
      return;
    }

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
  console.log("DOMContentLoaded");
  setMode("isolated");
  loadMunicipios();
});
