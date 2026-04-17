let FILAMENT_MAKERS = [];
let filaments = [];
let svgTemplate = "";
let currentFilamentMaker = null;

function currentTemplateUrl() {
  const templateId = document.getElementById("template-select").value;
  return currentFilamentMaker.templates.find((t) => t.id === templateId).url;
}

function isCustomTemplate() {
  return document.getElementById("template-select").value === "__custom__";
}

function toggleTemplateInfo() {
  const panel = document.getElementById("template-instructions");
  panel.style.display = panel.style.display === "none" ? "" : "none";
}

function onTemplateChange() {
  svgTemplate = "";
  document.getElementById("custom-template-input").value = "";
  document.getElementById("template-warning").style.display = "none";
  document.getElementById("template-instructions").style.display = "none";
  if (isCustomTemplate()) {
    document.getElementById("template-info-btn").style.display = "";
    document.getElementById("custom-template").style.display = "";
    document.getElementById("label-preview").style.display = "none";
    document.getElementById("generate-btn").disabled = true;
  } else {
    document.getElementById("template-info-btn").style.display = "none";
    document.getElementById("custom-template").style.display = "none";
    document.getElementById("label-preview").src = currentTemplateUrl();
    document.getElementById("label-preview").style.display = "";
    document.getElementById("generate-btn").disabled = false;
  }
}

function processTemplateFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    svgTemplate = e.target.result;
    applyTemplateDimensions(svgTemplate);

    const missing = validateTemplate(svgTemplate);
    const warning = document.getElementById("template-warning");
    if (missing.length > 0) {
      warning.innerHTML = `<button class="delete" onclick="this.parentElement.style.display='none'"></button>Missing fields:<ul>${missing.map((f) => `<li>${f.labels[0]}</li>`).join("")}</ul>`;
      warning.style.display = "";
    } else {
      warning.style.display = "none";
    }

    const blob = new Blob([svgTemplate], { type: "image/svg+xml" });
    document.getElementById("label-preview").src = URL.createObjectURL(blob);
    document.getElementById("label-preview").style.display = "";
    document.getElementById("generate-btn").disabled = false;
  };
  reader.readAsText(file);
}

function onCustomTemplate(event) {
  processTemplateFile(event.target.files[0]);
}

async function onFilamentMakerChange() {
  const filamentMakerId = document.getElementById("filament-maker-select").value;
  currentFilamentMaker = FILAMENT_MAKERS.find((b) => b.id === filamentMakerId);
  svgTemplate = "";

  const show = (id) => (document.getElementById(id).style.display = "");
  const hide = (id) => (document.getElementById(id).style.display = "none");

  if (!currentFilamentMaker) {
    ["section-template", "section-materials", "credits"].forEach(hide);
    return;
  }

  const templateSelect = document.getElementById("template-select");
  templateSelect.innerHTML = "";
  const builtInGroup = document.createElement("optgroup");
  builtInGroup.label = "Built-in";
  for (const t of currentFilamentMaker.templates) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    builtInGroup.appendChild(opt);
  }
  templateSelect.appendChild(builtInGroup);
  const customGroup = document.createElement("optgroup");
  customGroup.label = "Custom";
  const customOpt = document.createElement("option");
  customOpt.value = "__custom__";
  customOpt.textContent = "Upload your template...";
  customGroup.appendChild(customOpt);
  templateSelect.appendChild(customGroup);

  hide("template-info-btn");
  hide("custom-template");
  hide("template-instructions");
  show("label-preview");
  document.getElementById("label-preview").src = currentFilamentMaker.templates[0].url;
  show("section-template");

  const credits = document.getElementById("credits");
  credits.innerHTML = `Filament database by <a href="${currentFilamentMaker.credits.url}" target="_blank" rel="noopener">${currentFilamentMaker.credits.label}</a> — thanks!`;
  show("credits");

  const materialSelect = document.getElementById("material-select");
  materialSelect.innerHTML = "";
  materialSelect.disabled = true;

  const res = await fetch(currentFilamentMaker.dataUrl);
  filaments = await res.json();

  const materials = [...new Set(filaments.map((f) => f.material))].sort();
  const all = document.createElement("option");
  all.value = "__all__";
  all.textContent = "All materials";
  materialSelect.appendChild(all);
  for (const m of materials) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    materialSelect.appendChild(opt);
  }
  materialSelect.disabled = false;
  show("section-materials");
}

async function init() {
  FILAMENT_MAKERS = await fetch("./list.json").then((r) => r.json());

  const filamentMakerSelect = document.getElementById("filament-maker-select");
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select a filament maker…";
  placeholder.disabled = true;
  placeholder.selected = true;
  filamentMakerSelect.appendChild(placeholder);
  for (const filamentMaker of FILAMENT_MAKERS) {
    const opt = document.createElement("option");
    opt.value = filamentMaker.id;
    opt.textContent = filamentMaker.name;
    filamentMakerSelect.appendChild(opt);
  }

  document.getElementById("loading").style.display = "none";
  document.getElementById("screen-select").style.display = "flex";
  history.replaceState({ screen: "select" }, "", ".");
}

async function generate() {
  if (!svgTemplate) {
    if (isCustomTemplate()) return;
    svgTemplate = await fetch(currentTemplateUrl()).then((r) => r.text());
    applyTemplateDimensions(svgTemplate);
  }
  const val = document.getElementById("material-select").value;
  const filtered =
    val === "__all__"
      ? filaments
      : filaments.filter((f) => f.material === val);

  const grid = document.getElementById("labels-grid");
  grid.innerHTML = "";
  for (const f of filtered) {
    grid.appendChild(createLabel(svgTemplate, f));
  }

  const label = val === "__all__" ? "All materials" : val;
  document.getElementById("toolbar-title").textContent =
    `${currentFilamentMaker.name} — ${label} — ${filtered.length} label${filtered.length !== 1 ? "s" : ""}`;

  document.getElementById("screen-select").style.display = "none";
  document.getElementById("screen-labels").style.display = "block";
  history.pushState({ screen: "labels" }, "", "generation");
}

function back() {
  showSelect();
  history.back();
}

function goHome() {
  if (window.location.pathname.endsWith("/generation")) back();
}

function showSelect() {
  document.getElementById("screen-labels").style.display = "none";
  document.getElementById("screen-select").style.display = "flex";
}

function showLabels() {
  document.getElementById("screen-select").style.display = "none";
  document.getElementById("screen-labels").style.display = "block";
}

window.addEventListener("popstate", () => {
  if (window.location.pathname.endsWith("/generation")) showLabels();
  else showSelect();
});

const dropZone = document.getElementById("custom-template");
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});
dropZone.addEventListener("dragleave", (e) => {
  if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove("drag-over");
});
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith(".svg")) {
    document.getElementById("custom-template-input").value = "";
    processTemplateFile(file);
  }
});

init();
