
const API_BASE = "http://127.0.0.1:5002";


let isolatedItems = [];


let patchItems = [];

let appItems = [];


function byId(id) {
  return document.getElementById(id);
}

function showText(id, msg) {
  const el = byId(id);
  if (!el) return;
  el.textContent = msg || "";
}


function setMode(mode) {
  const isoSection    = byId("isolatedSection");
  const patchSection  = byId("patchSection");
  const statusSection = byId("statusSection");
  const appSection    = byId("appSection");  

  const tabIsolated = byId("tabIsolated");
  const tabPatch    = byId("tabPatch");
  const tabStatus   = byId("tabStatus");
  const tabApp      = byId("tabApp");        


  [isoSection, patchSection, statusSection, appSection].forEach((sec) => {
    if (sec) sec.style.display = "none";
  });


  [tabIsolated, tabPatch, tabStatus, tabApp].forEach((btn) => {
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
  } else if (mode === "app") {
    if (appSection) appSection.style.display = "block";
    if (tabApp) tabApp.classList.add("active");
  }
}


async function loadMunicipalities() {
  try {
    const resp = await fetch(`${API_BASE}/api/municipios`);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();

 
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


function addItem() {
  const qtyInput = byId("treeQuantity");
  const groupSelect = byId("treeGroup");
  const municipalitySelect = byId("isolatedMunicipality");
  const endangeredSelect = byId("treeEndangered"); 
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


  const endangeredValue = endangeredSelect ? endangeredSelect.value : "false";
  const endangered = endangeredValue === "true";

  if (!qtyStr || Number(qtyStr) <= 0) {
    if (errorBox) errorBox.textContent = "Informe uma quantidade válida.";
    return;
  }
  if (!municipality) {
    if (errorBox) errorBox.textContent = "Selecione um município.";
    return;
  }

  const quantidade = Number(qtyStr);


  const item = { quantidade, group, municipality, endangered };
  isolatedItems.push(item);


  const row = table.insertRow(-1);

  row.insertCell(0).textContent = quantidade;
  row.insertCell(1).textContent = group;
  row.insertCell(2).textContent = municipality;
  row.insertCell(3).textContent = ""; 
  row.insertCell(4).textContent = ""; 

  const delCell = row.insertCell(5);
  delCell.textContent = "×";
  delCell.classList.add("delete-btn");
  delCell.style.cursor = "pointer";
  delCell.onclick = () => {
    const index = row.rowIndex - 1; 
    isolatedItems.splice(index, 1);
    table.deleteRow(row.rowIndex);
  };

  qtyInput.value = "";
}



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
        errorBox.textContent = data.erro || data.error || `Erro HTTP ${resp.status} na API.`;
      }
      return;
    }

    
    const processed =
      data.processed_items ||          
      data["processed items"] ||       
      data.itens_processados ||        
      [];

    if (table && Array.isArray(processed)) {
      processed.forEach((item, idx) => {
        const row = table.rows[idx + 1]; 
        if (!row) return;

        
        if (row.cells[3]) {
          row.cells[3].textContent =
            item.compensacao_por_arvore != null
              ? item.compensacao_por_arvore
              : "";
        }
        if (row.cells[4]) {
          row.cells[4].textContent =
            item.compensacao_total_item != null
              ? item.compensacao_total_item
              : "";
        }
      });
    }

    
    const total =
      data.total_compensation ??       
      data["total compensation"] ??    
      data.total_compensacao_geral ??
      data.total_compensacao_lote ??
      data.total ??
      0;

    if (totalBox) {
      totalBox.textContent = `Compensação total do lote: ${total}`;
    }

    
    const semRegra =
      data.items_without_compensation ||  
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
  
  row.insertCell(0).textContent = municipality;
  row.insertCell(1).textContent = area_m2;
  row.insertCell(2).textContent = ""; 
  row.insertCell(3).textContent = ""; 

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

async function loadAppMunicipalities() {
  const select = document.getElementById("appMunicipality");
  if (!select) return;

  try {
    const resp = await fetch(`${API_BASE}/api/app_municipios`);
    const data = await resp.json();
    const municipios = data.municipios || [];

    select.innerHTML = '<option value="">Selecione o município</option>';
    municipios.forEach((muni) => {
      const opt = document.createElement("option");
      opt.value = muni;
      opt.textContent = muni;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Erro ao carregar municípios de APP:", err);
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

    const data = await resp.json();   

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

function addAppItem() {
  const municipalitySelect = document.getElementById("appMunicipality");
  const quantityInput = document.getElementById("appQuantity");
  const table = document.getElementById("appTable");
  const errorBoxApp = document.getElementById("errorBoxApp");

  if (!municipalitySelect || !quantityInput || !table) {
    console.warn("Elementos de APP não encontrados.");
    return;
  }

  if (errorBoxApp) errorBoxApp.textContent = "";

  const municipality = municipalitySelect.value;
  const quantityStr = quantityInput.value;

  if (!municipality) {
    if (errorBoxApp) errorBoxApp.textContent = "Selecione um município.";
    return;
  }
  if (!quantityStr || Number(quantityStr) <= 0) {
    if (errorBoxApp)
      errorBoxApp.textContent = "Informe uma quantidade / área válida.";
    return;
  }

  const quantidade = Number(quantityStr);
  appItems.push({ municipality, quantidade });

  const tbody = table.tBodies[0] || table.createTBody();
  const row = tbody.insertRow(-1);

  row.insertCell(0).textContent = municipality;
  row.insertCell(1).textContent = quantidade;
  row.insertCell(2).textContent = ""; 
  row.insertCell(3).textContent = ""; 

  const delCell = row.insertCell(4);
  delCell.textContent = "×";
  delCell.classList.add("delete-btn");
  delCell.style.cursor = "pointer";
  delCell.onclick = () => {
    const index = row.rowIndex - 1; 
    appItems.splice(index, 1);
    row.remove();
  };

  quantityInput.value = "";
}

async function calculateAppTotal() {
  const errorBoxApp = document.getElementById("errorBoxApp");
  const totalBoxApp = document.getElementById("totalBoxApp");
  const table = document.getElementById("appTable");

  if (errorBoxApp) errorBoxApp.textContent = "";
  if (totalBoxApp) totalBoxApp.textContent = "";

  if (!appItems.length) {
    if (errorBoxApp)
      errorBoxApp.textContent = "Adicione pelo menos um item de APP.";
    return;
  }

  const payload = {
    apps: appItems.map((item) => ({
      municipality: item.municipality,
      quantidade: item.quantidade,
    })),
  };

  try {
    const resp = await fetch(`${API_BASE}/api/compensacao/app`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();
    console.log("Resposta /api/compensacao/app:", data);

    if (!resp.ok) {
      if (errorBoxApp)
        errorBoxApp.textContent =
          data.erro || `Erro HTTP ${resp.status} na API (APP).`;
      return;
    }

    const processed = data.apps_processados || [];
    const tbody = table.tBodies[0] || table.createTBody();

    processed.forEach((item, idx) => {
      const row = tbody.rows[idx];
      if (!row) return;
      row.cells[2].textContent = item.compensacao_por_unidade ?? "";
      row.cells[3].textContent = item.compensacao_total_app ?? "";
    });

    const total = data.total_compensacao_geral ?? 0;
    if (totalBoxApp) {
      totalBoxApp.textContent = `Compensação total de APP: ${total}`;
    }

    const semRegra = data.apps_sem_regra || [];
    if (semRegra.length && errorBoxApp) {
      errorBoxApp.textContent +=
        " Alguns itens de APP não tiveram regra de compensação.";
    }
  } catch (err) {
    console.error("Erro na requisição /api/compensacao/app:", err);
    if (errorBoxApp)
      errorBoxApp.textContent = "Erro de conexão com a API (APP).";
  }
}




window.setMode = setMode;
window.addItem = addItem;
window.calculateTotal = calculateTotal;
window.addPatchItem = addPatchItem;
window.calculatePatchTotal = calculatePatchTotal;
window.searchStatus = searchStatus;
window.consultStatus = consultStatus;
window.addAppItem = addAppItem;
window.calculateAppTotal = calculateAppTotal;


window.addEventListener("DOMContentLoaded", () => {
  console.log("scripts.js carregado - DOM pronto");
  setMode("isolated");   
  loadMunicipalities();  
  loadAppMunicipalities();
});
