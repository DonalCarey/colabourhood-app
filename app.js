const STATUS = {
  proposed: { label: "Proposed", color: "#5d8390" },
  gathering: { label: "Gathering support", color: "#d75f48" },
  ready: { label: "Ready to act", color: "#efc75e" },
  completed: { label: "Completed", color: "#235b49" },
};

const NEIGHBOURHOOD_CENTER = [52.6454687, -8.6362558];
const NEIGHBOURHOOD_BOUNDS = [
  [52.6432195, -8.6386079],
  [52.6477796, -8.6313332],
];
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

let projects = [
  {
    id: 1,
    slug: "safer-crossing-ballinacurra-gardens",
    scope: "place",
    title: "A safer crossing on Ballinacurra Gardens",
    shortTitle: "Safer crossing",
    location: "Ballinacurra Gardens",
    status: "gathering",
    neighbours: 34,
    description:
      "A resident-led plan for a safer place to cross, with local observations, design options and a shared budget.",
    lat: 52.64512,
    lng: -8.63546,
  },
  {
    id: 2,
    slug: "community-tool-library",
    scope: "place",
    title: "Community tool library",
    shortTitle: "Tool library",
    location: "Near the community green",
    status: "ready",
    neighbours: 21,
    description:
      "A shared store of useful garden and household tools, maintained and booked by neighbours.",
    lat: 52.64637,
    lng: -8.63438,
  },
  {
    id: 3,
    slug: "spring-street-clean-up",
    scope: "place",
    title: "Spring street clean-up",
    shortTitle: "Street clean-up",
    location: "Southern end of Ballinacurra Gardens",
    status: "completed",
    neighbours: 46,
    description:
      "A coordinated morning to clear litter, trim shared edges and make the neighbourhood welcoming again.",
    lat: 52.64389,
    lng: -8.63672,
  },
  {
    id: 4,
    slug: "play-space-for-younger-children",
    scope: "place",
    title: "A play space for younger children",
    shortTitle: "Play space",
    location: "The neighbourhood green",
    status: "proposed",
    neighbours: 12,
    description:
      "Explore a modest, safe play area shaped and funded by families living around the green.",
    lat: 52.64682,
    lng: -8.63712,
  },
  {
    id: 5,
    slug: "bulk-buy-home-energy-upgrades",
    scope: "neighbourhood",
    title: "Bulk-buy home energy upgrades",
    shortTitle: "Energy upgrade group",
    location: "Across Ballinacurra Gardens",
    status: "gathering",
    neighbours: 18,
    description:
      "Bring interested households together to compare options, invite installers to quote and negotiate a better group price.",
  },
];

let selectedId = 1;
let currentFilter = "all";
let placing = false;
let pendingLocation = null;
let pendingMarker = null;
let proposalScope = "place";
let mobileDrawerOpen = window.innerWidth > 760;

const list = document.querySelector("#project-list");
const drawer = document.querySelector("#detail-drawer");
const canvas = document.querySelector(".map-canvas");
const locationBanner = document.querySelector("#location-banner");
const neighbourhoodProjects = document.querySelector("#neighbourhood-projects");
const scopeModal = document.querySelector("#scope-modal");
const modal = document.querySelector("#project-modal");
const form = document.querySelector("#project-form");
const toast = document.querySelector("#toast");
const chosenLocation = document.querySelector(".chosen-location");
const formStep = document.querySelector("#form-step");
const modalTitle = document.querySelector("#modal-title");
const markers = new Map();

const map = L.map("leaflet-map", {
  zoomControl: true,
  attributionControl: true,
  minZoom: 14,
  maxZoom: 19,
}).fitBounds(NEIGHBOURHOOD_BOUNDS, { padding: [24, 24] });

L.tileLayer(TILE_URL, {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const neighbourhoodBoundary = L.rectangle(NEIGHBOURHOOD_BOUNDS, {
  color: "#235b49",
  weight: 2,
  opacity: 0.65,
  fillColor: "#cddfd1",
  fillOpacity: 0.08,
  dashArray: "6 7",
  interactive: false,
}).addTo(map);

function visibleProjects() {
  return currentFilter === "all"
    ? projects
    : projects.filter((project) => project.status === currentFilter);
}

function markerHtml(project, isSelected = false) {
  const sizeClass = isSelected ? " is-selected" : "";
  return `
    <div class="leaflet-project-marker${sizeClass}" style="--status:${STATUS[project.status].color}">
      <span class="leaflet-pin-label">${project.shortTitle}</span>
      <svg viewBox="0 0 42 52" aria-hidden="true">
        <path d="M21 50S39 35.2 39 19.5a18 18 0 1 0-36 0C3 35.2 21 50 21 50Z"/>
        <circle cx="21" cy="19" r="5"/>
      </svg>
    </div>`;
}

function markerIcon(project) {
  return L.divIcon({
    className: "project-marker-shell",
    html: markerHtml(project, project.id === selectedId),
    iconSize: project.id === selectedId ? [50, 60] : [42, 52],
    iconAnchor: project.id === selectedId ? [25, 58] : [21, 50],
  });
}

function renderList() {
  const visible = visibleProjects();
  list.innerHTML = visible.length
    ? visible
        .map(
          (project) => `
            <button class="project-row ${project.id === selectedId ? "selected" : ""}"
              style="--status:${STATUS[project.status].color}" data-project="${project.id}">
              <span class="status-dot"></span>
              <span>
                <strong>${project.title}</strong>
                <small>${project.neighbours} neighbours · ${STATUS[project.status].label}${project.scope === "neighbourhood" ? " · Neighbourhood-wide" : ""}</small>
              </span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
            </button>`
        )
        .join("")
    : `<p class="empty-list">No projects have this status yet.</p>`;
}

function syncMarkers() {
  const visibleIds = new Set(visibleProjects().map((project) => project.id));
  projects.forEach((project) => {
    if (project.scope === "neighbourhood") return;
    let marker = markers.get(project.id);
    if (!marker) {
      marker = L.marker([project.lat, project.lng], {
        icon: markerIcon(project),
        title: project.title,
        keyboard: true,
      }).on("click", () => selectProject(project.id));
      markers.set(project.id, marker);
    }
    marker.setLatLng([project.lat, project.lng]);
    marker.setIcon(markerIcon(project));
    if (visibleIds.has(project.id)) {
      if (!map.hasLayer(marker)) marker.addTo(map);
    } else if (map.hasLayer(marker)) {
      map.removeLayer(marker);
    }
  });
}

function renderNeighbourhoodProjects() {
  const visible = visibleProjects().filter((project) => project.scope === "neighbourhood");
  neighbourhoodProjects.innerHTML = visible
    .map(
      (project) => `
        <button class="neighbourhood-project-button ${project.id === selectedId ? "selected" : ""}"
          style="--status:${STATUS[project.status].color}" data-project="${project.id}">
          <span class="area-symbol">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5 12 4l8 4.5v9L12 22l-8-4.5v-9Z"/><path d="m4 8.5 8 4.5 8-4.5M12 13v9"/></svg>
          </span>
          <span><strong>${project.title}</strong><small>Across Ballinacurra Gardens · ${project.neighbours} involved</small></span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
        </button>`
    )
    .join("");
}

function renderDrawer() {
  const project = projects.find((item) => item.id === selectedId);
  if (!project || (window.innerWidth <= 760 && !mobileDrawerOpen)) {
    drawer.hidden = true;
    return;
  }
  drawer.hidden = false;
  drawer.style.setProperty("--status", STATUS[project.status].color);
  drawer.innerHTML = `
    <div class="drawer-topline">
      <span class="status-label"><i class="status-dot"></i>${STATUS[project.status].label}</span>
      <button class="drawer-close" aria-label="Close project details">×</button>
    </div>
    <h2>${project.title}</h2>
    <p class="drawer-location">
      ${project.scope === "neighbourhood"
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5 12 4l8 4.5v9L12 22l-8-4.5v-9Z"/><path d="m4 8.5 8 4.5 8-4.5M12 13v9"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>'}
      ${project.location}
    </p>
    <p class="drawer-description">${project.description}</p>
    <div class="neighbour-count">
      <span class="neighbour-faces"><i></i><i></i><i></i></span>
      ${project.neighbours} neighbours involved
    </div>
    <p class="contribution-title">How could you help?</p>
    <div class="contributions">
      ${["Time", "Skills", "Tools", "Funds"]
        .map((type) => `<button class="contribution" data-contribution="${type}">${type}</button>`)
        .join("")}
    </div>
    <div class="drawer-actions">
      <button class="button button-dark" data-action="join">Join this project</button>
      <button class="button button-light" data-action="offer">Offer help</button>
    </div>
    <a class="button open-project-button" href="./projects/${project.slug}/index.html">
      Open project
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
    </a>`;
}

function render() {
  renderList();
  syncMarkers();
  renderNeighbourhoodProjects();
  renderDrawer();
  const selected = projects.find((project) => project.id === selectedId);
  neighbourhoodBoundary.setStyle(
    selected?.scope === "neighbourhood"
      ? { color: STATUS[selected.status].color, weight: 4, opacity: 0.9, fillColor: STATUS[selected.status].color, fillOpacity: 0.16 }
      : { color: "#235b49", weight: 2, opacity: 0.65, fillColor: "#cddfd1", fillOpacity: 0.08 }
  );
}

function selectProject(id) {
  selectedId = Number(id);
  mobileDrawerOpen = true;
  cancelLocationChoice();
  render();
  const project = projects.find((item) => item.id === selectedId);
  if (project?.scope === "neighbourhood") {
    map.fitBounds(NEIGHBOURHOOD_BOUNDS, { padding: [28, 28], animate: true });
  } else if (project) {
    map.panTo([project.lat, project.lng], { animate: true });
  }
}

function openScopeChoice() {
  scopeModal.hidden = false;
  modal.hidden = true;
  cancelLocationChoice();
}

function beginLocationChoice() {
  proposalScope = "place";
  scopeModal.hidden = true;
  placing = true;
  pendingLocation = null;
  modal.hidden = true;
  if (pendingMarker) {
    map.removeLayer(pendingMarker);
    pendingMarker = null;
  }
  locationBanner.hidden = false;
  canvas.classList.add("placing");
  map.getContainer().focus();
}

function beginNeighbourhoodProject() {
  proposalScope = "neighbourhood";
  scopeModal.hidden = true;
  pendingLocation = null;
  cancelLocationChoice();
  formStep.textContent = "New project · neighbourhood-wide";
  modalTitle.textContent = "What could neighbours do together?";
  chosenLocation.lastChild.textContent = " Across Ballinacurra Gardens";
  modal.hidden = false;
  form.querySelector("input").focus();
}

function cancelLocationChoice() {
  placing = false;
  locationBanner.hidden = true;
  canvas.classList.remove("placing");
  if (pendingMarker) {
    map.removeLayer(pendingMarker);
    pendingMarker = null;
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => (toast.hidden = true), 2600);
}

function pendingIcon() {
  return L.divIcon({
    className: "project-marker-shell",
    html: `
      <div class="leaflet-project-marker pending-marker" style="--status:${STATUS.proposed.color}">
        <svg viewBox="0 0 42 52" aria-hidden="true">
          <path d="M21 50S39 35.2 39 19.5a18 18 0 1 0-36 0C3 35.2 21 50 21 50Z"/>
          <circle cx="21" cy="19" r="5"/>
        </svg>
      </div>`,
    iconSize: [42, 52],
    iconAnchor: [21, 50],
  });
}

function openProjectForm(latlng) {
  proposalScope = "place";
  pendingLocation = latlng;
  pendingMarker = L.marker(latlng, { icon: pendingIcon(), interactive: false }).addTo(map);
  chosenLocation.lastChild.textContent = ` ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)} · Ballinacurra Gardens`;
  formStep.textContent = "New project · location chosen";
  modalTitle.textContent = "What should happen here?";
  placing = false;
  canvas.classList.remove("placing");
  locationBanner.hidden = true;
  modal.hidden = false;
  form.querySelector("input").focus();
}

document.addEventListener("click", (event) => {
  const projectControl = event.target.closest("[data-project]");
  if (projectControl) selectProject(projectControl.dataset.project);

  const filter = event.target.closest("[data-filter]");
  if (filter) {
    currentFilter = filter.dataset.filter;
    document.querySelectorAll(".filter").forEach((button) =>
      button.classList.toggle("active", button === filter)
    );
    const visible = visibleProjects();
    if (!visible.some((project) => project.id === selectedId) && visible[0]) {
      selectedId = visible[0].id;
    }
    render();
  }

  const contribution = event.target.closest("[data-contribution]");
  if (contribution) contribution.classList.toggle("selected");

  const action = event.target.closest("[data-action]");
  if (action?.dataset.action === "join") {
    const project = projects.find((item) => item.id === selectedId);
    if (!action.dataset.joined) {
      project.neighbours += 1;
      action.dataset.joined = "true";
      action.textContent = "You’ve joined";
      showToast("You’re now part of this project.");
      renderList();
    }
  }
  if (action?.dataset.action === "offer") {
    document.querySelector(".contribution")?.focus();
    showToast("Choose the kind of help you can offer.");
  }

  if (event.target.closest(".drawer-close")) {
    mobileDrawerOpen = false;
    renderDrawer();
  }
});

["#header-propose", "#rail-propose"].forEach((selector) =>
  document.querySelector(selector).addEventListener("click", openScopeChoice)
);

document.querySelector("#scope-close").addEventListener("click", () => (scopeModal.hidden = true));
document.querySelector("#scope-place").addEventListener("click", beginLocationChoice);
document.querySelector("#scope-neighbourhood").addEventListener("click", beginNeighbourhoodProject);
document.querySelector("#cancel-location").addEventListener("click", cancelLocationChoice);
document.querySelector("#modal-close").addEventListener("click", () => {
  modal.hidden = true;
  cancelLocationChoice();
});
document.querySelector("#modal-back").addEventListener("click", openScopeChoice);

map.on("click", (event) => {
  if (placing) openProjectForm(event.latlng);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const title = data.get("title").trim();
  const description = data.get("description").trim();
  const location = pendingLocation || L.latLng(NEIGHBOURHOOD_CENTER);
  const project = {
    id: Date.now(),
    scope: proposalScope,
    title,
    shortTitle: title.length > 22 ? `${title.slice(0, 21)}…` : title,
    location: proposalScope === "neighbourhood" ? "Across Ballinacurra Gardens" : "Ballinacurra Gardens",
    status: "proposed",
    neighbours: 1,
    description,
    ...(proposalScope === "place" ? { lat: location.lat, lng: location.lng } : {}),
  };
  projects = [...projects, project];
  selectedId = project.id;
  currentFilter = "all";
  document.querySelectorAll(".filter").forEach((button) =>
    button.classList.toggle("active", button.dataset.filter === "all")
  );
  form.reset();
  modal.hidden = true;
  if (pendingMarker) map.removeLayer(pendingMarker);
  pendingMarker = null;
  pendingLocation = null;
  render();
  if (project.scope === "neighbourhood") {
    map.fitBounds(NEIGHBOURHOOD_BOUNDS, { padding: [28, 28] });
  } else {
    map.panTo([project.lat, project.lng]);
  }
  showToast("Your proposed project is now on the neighbourhood map.");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    scopeModal.hidden = true;
    modal.hidden = true;
    cancelLocationChoice();
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 760) mobileDrawerOpen = true;
  renderDrawer();
  map.invalidateSize();
});

window.setTimeout(() => map.invalidateSize(), 0);
render();
