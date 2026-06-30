const STATUS = {
  proposed: { label: "Proposed", color: "#5d8390" },
  gathering: { label: "Gathering support", color: "#d75f48" },
  ready: { label: "Ready to act", color: "#efc75e" },
  completed: { label: "Completed", color: "#235b49" },
};

const NEIGHBOURHOOD_CENTER = [52.64565, -8.63435];
const NEIGHBOURHOOD_BOUNDS = [
  [52.64275, -8.6396],
  [52.64845, -8.62885],
];
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const PILOT_NEIGHBOURHOOD_NAME = "Ballinacurra Gardens, Oakview Drive, Greenfields & Roundwood Estate";
const LEGACY_PILOT_NEIGHBOURHOOD_NAME = "Ballinacurra Gardens";

const DEMO_PROJECTS = [
  {
    id: "demo-1",
    slug: "safer-crossing-ballinacurra-gardens",
    scope: "place",
    title: "A safer crossing on Ballinacurra Gardens",
    shortTitle: "Safer crossing",
    location: "Ballinacurra Gardens near the green",
    status: "gathering",
    neighbours: 34,
    description:
      "Gather observations, compare low-cost options and agree a practical resident-backed crossing improvement.",
    lat: 52.64512,
    lng: -8.63546,
  },
  {
    id: "demo-2",
    slug: "greenfields-oakview-planting-tidy-up",
    scope: "place",
    title: "Greenfields and Oakview planting tidy-up",
    shortTitle: "Planting tidy-up",
    location: "Greenfields / Oakview Drive shared green edge",
    status: "ready",
    neighbours: 27,
    description:
      "Prepare a shared green edge, plant hardy low-maintenance shrubs and organise a short watering rota.",
    lat: 52.64628,
    lng: -8.63192,
  },
  {
    id: "demo-3",
    slug: "community-tool-library",
    scope: "neighbourhood",
    title: "Community tool library",
    shortTitle: "Tool library",
    location: `Across ${PILOT_NEIGHBOURHOOD_NAME}`,
    status: "proposed",
    neighbours: 22,
    description:
      "Build a small shared inventory of household and garden tools that neighbours can borrow.",
  },
];

let liveProjects = [];
let projects = [...DEMO_PROJECTS];
let selectedId = "demo-1";
let currentFilter = "all";
let placing = false;
let pendingLocation = null;
let pendingMarker = null;
let proposalScope = "place";
let mobileDrawerOpen = window.innerWidth > 760;
let authMode = "signup";
let currentUser = null;
let currentProfile = null;
let neighbourhoods = [];

const supabaseClient = window.COLABOURHOOD_SUPABASE;
const FALLBACK_NEIGHBOURHOODS = [
  { id: "", name: PILOT_NEIGHBOURHOOD_NAME },
  { id: "", name: "Corbally" },
  { id: "", name: "Castletroy" },
  { id: "", name: "Dooradoyle" },
  { id: "", name: "Raheen" },
  { id: "", name: "City Centre" },
  { id: "", name: "Thomondgate" },
  { id: "", name: "Annacotty" },
];

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
const accountButton = document.querySelector("#account-button");
const accountLabel = document.querySelector("#account-label");
const accountModal = document.querySelector("#account-modal");
const accountForm = document.querySelector("#account-form");
const accountSubmit = document.querySelector("#account-submit");
const neighbourhoodSelect = document.querySelector("#neighbourhood-select");
const signedInPanel = document.querySelector("#signed-in-panel");
const signedInName = document.querySelector("#signed-in-name");
const signedInMeta = document.querySelector("#signed-in-meta");
const accountAdminLink = document.querySelector("#account-admin-link");
const welcomeModal = document.querySelector("#welcome-modal");
const welcomeClose = document.querySelector("#welcome-close");
const welcomeStart = document.querySelector("#welcome-start");
const markers = new Map();
const WELCOME_SEEN_KEY = "colabourhood-welcome-seen-v1";

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

function appStatusFromDatabase(status) {
  return {
    proposed: "proposed",
    gathering_support: "gathering",
    planning: "ready",
    active: "ready",
    completed: "completed",
    paused: "proposed",
    removed: "proposed",
  }[status] || "proposed";
}

function databaseStatusFromApp(status) {
  return {
    proposed: "proposed",
    gathering: "gathering_support",
    ready: "active",
    completed: "completed",
  }[status] || "proposed";
}

function scopeFromDatabase(type) {
  return type === "neighbourhood_wide" ? "neighbourhood" : "place";
}

function typeFromScope(scope) {
  return scope === "neighbourhood" ? "neighbourhood_wide" : "location_based";
}

function isObviousTestProjectRow(row) {
  const title = (row.title || "").trim().toLowerCase();
  const summary = (row.summary || "").trim().toLowerCase();
  const description = (row.description || "").trim().toLowerCase();

  return (
    title === "test" ||
    title === "garden tidy" ||
    summary === "this is a test" ||
    summary === "cut the garden grass" ||
    description.includes("this is a test") ||
    description.includes("cut the garden grass")
  );
}

function shortTitle(title) {
  return title.length > 22 ? `${title.slice(0, 21)}…` : title;
}

function activeNeighbourhood() {
  return (
    neighbourhoods.find((neighbourhood) => neighbourhood.id === currentProfile?.neighbourhood_id) ||
    neighbourhoods.find((neighbourhood) => isPilotNeighbourhoodName(neighbourhood.name)) ||
    null
  );
}

function isPilotNeighbourhoodName(name = "") {
  return name === PILOT_NEIGHBOURHOOD_NAME || name === LEGACY_PILOT_NEIGHBOURHOOD_NAME;
}

function displayNeighbourhoodName(name = "") {
  return isPilotNeighbourhoodName(name) ? PILOT_NEIGHBOURHOOD_NAME : name;
}

function activeNeighbourhoodName() {
  return displayNeighbourhoodName(activeNeighbourhood()?.name) || PILOT_NEIGHBOURHOOD_NAME;
}

function liveProjectFromRow(row, supportCount = 0) {
  const scope = scopeFromDatabase(row.project_type);
  const neighbourhood = neighbourhoods.find((item) => item.id === row.neighbourhood_id);
  return {
    id: row.id,
    isLive: true,
    scope,
    title: row.title,
    shortTitle: shortTitle(row.title),
    location:
      scope === "neighbourhood"
        ? `Across ${neighbourhood?.name || activeNeighbourhoodName()}`
        : row.location_label || neighbourhood?.name || activeNeighbourhoodName(),
    status: appStatusFromDatabase(row.status),
    neighbours: Math.max(1, supportCount || 0),
    description: row.description,
    ...(scope === "place"
      ? { lat: Number(row.location_lat), lng: Number(row.location_lng) }
      : {}),
  };
}

function syncProjectCollection() {
  const neighbourhood = activeNeighbourhood();
  const demoProjects = isPilotNeighbourhoodName(neighbourhood?.name) ? DEMO_PROJECTS : [];
  projects = [...demoProjects, ...liveProjects];

  const projectIds = new Set(projects.map((project) => project.id));
  markers.forEach((marker, id) => {
    if (!projectIds.has(id)) {
      map.removeLayer(marker);
      markers.delete(id);
    }
  });

  if (!projects.some((project) => project.id === selectedId)) {
    selectedId = projects[0]?.id || null;
  }
}

async function loadLiveProjects() {
  const neighbourhood = activeNeighbourhood();
  if (!supabaseClient || !neighbourhood?.id) {
    liveProjects = [];
    syncProjectCollection();
    render();
    return;
  }

  const { data, error } = await supabaseClient
    .from("projects")
    .select("id, neighbourhood_id, created_by, title, summary, description, project_type, status, location_lat, location_lng, location_label, created_at")
    .eq("neighbourhood_id", neighbourhood.id)
    .eq("is_hidden", false)
    .neq("status", "removed")
    .order("created_at", { ascending: false });

  if (error) {
    showToast("Could not load live projects yet.");
    return;
  }

  const rows = (data || []).filter((row) => !isObviousTestProjectRow(row));
  const ids = rows.map((row) => row.id);
  let supportCounts = new Map();

  if (ids.length) {
    const { data: contributions } = await supabaseClient
      .from("project_contributions")
      .select("project_id")
      .in("project_id", ids)
      .eq("contribution_type", "support");

    supportCounts = new Map();
    (contributions || []).forEach((contribution) => {
      supportCounts.set(contribution.project_id, (supportCounts.get(contribution.project_id) || 0) + 1);
    });
  }

  liveProjects = rows.map((row) => liveProjectFromRow(row, supportCounts.get(row.id)));
  syncProjectCollection();
  render();
}

async function saveLiveProject(project) {
  const neighbourhood = activeNeighbourhood();
  if (!supabaseClient || !currentUser || !currentProfile || !neighbourhood?.id) {
    throw new Error("Sign in and choose a neighbourhood before proposing a project.");
  }

  const payload = {
    neighbourhood_id: neighbourhood.id,
    created_by: currentUser.id,
    title: project.title,
    summary: project.description.slice(0, 180),
    description: project.description,
    project_type: typeFromScope(project.scope),
    status: databaseStatusFromApp(project.status),
    location_label: project.location,
    location_lat: project.scope === "place" ? project.lat : null,
    location_lng: project.scope === "place" ? project.lng : null,
  };

  const { data, error } = await supabaseClient.from("projects").insert(payload).select().single();
  if (error) throw error;

  await supabaseClient.from("project_contributions").insert({
    project_id: data.id,
    user_id: currentUser.id,
    contribution_type: "support",
    note: "Project proposer",
    is_public: true,
  });

  return data;
}

async function supportLiveProject(project) {
  if (!supabaseClient || !currentUser || !project?.isLive) return false;

  const { error } = await supabaseClient.from("project_contributions").upsert(
    {
      project_id: project.id,
      user_id: currentUser.id,
      contribution_type: "support",
      is_public: true,
    },
    { onConflict: "project_id,user_id,contribution_type" }
  );

  if (error) throw error;
  return true;
}

function markerHtml(project, isSelected = false) {
  const sizeClass = isSelected ? " is-selected" : "";
  const status = STATUS[project.status] || STATUS.proposed;
  return `
    <div class="leaflet-project-marker${sizeClass}" style="--status:${status.color}">
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
              style="--status:${(STATUS[project.status] || STATUS.proposed).color}" data-project="${project.id}">
              <span class="status-dot"></span>
              <span>
                <strong>${project.title}</strong>
                <small>${project.neighbours} neighbours · ${(STATUS[project.status] || STATUS.proposed).label}${project.scope === "neighbourhood" ? " · Neighbourhood-wide" : ""}</small>
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
          style="--status:${(STATUS[project.status] || STATUS.proposed).color}" data-project="${project.id}">
          <span class="area-symbol">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5 12 4l8 4.5v9L12 22l-8-4.5v-9Z"/><path d="m4 8.5 8 4.5 8-4.5M12 13v9"/></svg>
          </span>
          <span><strong>${project.title}</strong><small>Across ${activeNeighbourhoodName()} · ${project.neighbours} involved</small></span>
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
  const status = STATUS[project.status] || STATUS.proposed;
  const projectPageAction = project.slug
    ? `<a class="button open-project-button" href="./projects/${project.slug}/index.html">
      Open project
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
    </a>`
    : `<a class="button open-project-button" href="./live-project.html?id=${encodeURIComponent(project.id)}">
      Open project
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
    </a>`;
  drawer.style.setProperty("--status", status.color);
  drawer.innerHTML = `
    <div class="drawer-topline">
      <span class="status-label"><i class="status-dot"></i>${status.label}</span>
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
    ${projectPageAction}`;
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
  selectedId = id;
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
  if (!currentUser) {
    openAccountModal();
    return;
  }
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
  chosenLocation.lastChild.textContent = ` Across ${activeNeighbourhoodName()}`;
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

function friendlyVerificationStatus(status) {
  return {
    unverified: "Residency not verified yet",
    pending: "Residency verification pending",
    verified: "Verified resident",
    rejected: "Verification needs attention",
  }[status || "unverified"];
}

function neighbourhoodName(id) {
  return displayNeighbourhoodName(neighbourhoods.find((neighbourhood) => neighbourhood.id === id)?.name) || "Neighbourhood not selected";
}

function renderNeighbourhoodOptions() {
  const options = neighbourhoods.length ? neighbourhoods : FALLBACK_NEIGHBOURHOODS;
  neighbourhoodSelect.innerHTML = [
    `<option value="">Choose a Limerick pilot area</option>`,
    ...options.map((neighbourhood) => `<option value="${neighbourhood.id}">${displayNeighbourhoodName(neighbourhood.name)}</option>`),
  ].join("");
}

async function loadNeighbourhoods() {
  if (!supabaseClient) {
    neighbourhoods = FALLBACK_NEIGHBOURHOODS;
    renderNeighbourhoodOptions();
    return;
  }

  const { data, error } = await supabaseClient
    .from("neighbourhoods")
    .select("id, name")
    .eq("city", "Limerick")
    .eq("is_active", true)
    .order("name");

  if (error) {
    neighbourhoods = FALLBACK_NEIGHBOURHOODS;
    showToast("Could not load live neighbourhoods yet.");
  } else {
    neighbourhoods = data || [];
  }
  renderNeighbourhoodOptions();
}

async function loadProfile(userId) {
  if (!supabaseClient || !userId) return null;
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, display_name, neighbourhood_id, verification_status, is_admin")
    .eq("id", userId)
    .single();

  if (error) return null;
  return data;
}

function renderAccountState() {
  accountButton.classList.toggle("signed-in", Boolean(currentUser));
  accountLabel.textContent = currentProfile?.display_name || currentUser?.email?.split("@")[0] || "Sign in";

  const isSignedIn = Boolean(currentUser);
  accountForm.hidden = isSignedIn;
  signedInPanel.hidden = !isSignedIn;
  if (accountAdminLink) accountAdminLink.hidden = !currentProfile?.is_admin;

  if (isSignedIn) {
    signedInName.textContent = currentProfile?.display_name || currentUser.email;
    signedInMeta.textContent = `${neighbourhoodName(currentProfile?.neighbourhood_id)} · ${friendlyVerificationStatus(
      currentProfile?.verification_status
    )}`;
  }
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll("[data-auth-mode]").forEach((button) =>
    button.classList.toggle("active", button.dataset.authMode === mode)
  );
  document.querySelectorAll("[data-signup-only]").forEach((element) => {
    element.hidden = mode !== "signup";
  });
  accountSubmit.textContent = mode === "signup" ? "Create account" : "Sign in";
  accountForm.querySelector('[name="password"]').autocomplete =
    mode === "signup" ? "new-password" : "current-password";
}

function showWelcomeModalIfNeeded() {
  if (!welcomeModal) return;
  if (localStorage.getItem(WELCOME_SEEN_KEY) === "true") return;
  welcomeModal.hidden = false;
}

function dismissWelcomeModal() {
  if (!welcomeModal) return;
  localStorage.setItem(WELCOME_SEEN_KEY, "true");
  welcomeModal.hidden = true;
}

async function refreshSession() {
  if (!supabaseClient) {
    renderAccountState();
    return;
  }

  const { data } = await supabaseClient.auth.getSession();
  currentUser = data.session?.user || null;
  currentProfile = currentUser ? await loadProfile(currentUser.id) : null;
  renderAccountState();
}

function openAccountModal() {
  accountModal.hidden = false;
  renderAccountState();
  if (!currentUser) accountForm.querySelector('[name="email"]').focus();
}

function authRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

async function resendSignupConfirmation(email) {
  if (!supabaseClient || !email) return;

  const { error } = await supabaseClient.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: authRedirectUrl(),
    },
  });

  if (error) throw error;
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
  chosenLocation.lastChild.textContent = ` ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)} · ${activeNeighbourhoodName()}`;
  formStep.textContent = "New project · location chosen";
  modalTitle.textContent = "What should happen here?";
  placing = false;
  canvas.classList.remove("placing");
  locationBanner.hidden = true;
  modal.hidden = false;
  form.querySelector("input").focus();
}

document.addEventListener("click", async (event) => {
  const joinAction = event.target.closest('[data-action="join"]');
  if (joinAction && currentUser) {
    const project = projects.find((item) => item.id === selectedId);
    if (!project || joinAction.dataset.joined) return;

    joinAction.disabled = true;
    try {
      await supportLiveProject(project);
      project.neighbours += 1;
      joinAction.dataset.joined = "true";
      joinAction.textContent = "You’ve joined";
      showToast("You’re now part of this project.");
      renderList();
      if (project.isLive) await loadLiveProjects();
    } catch (error) {
      showToast(error.message || "Could not join this project yet.");
    } finally {
      joinAction.disabled = false;
    }
    return;
  }

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
  if (contribution) {
    if (!currentUser) {
      openAccountModal();
      showToast("Sign in to offer help on a project.");
      return;
    }
    contribution.classList.toggle("selected");
  }

  const action = event.target.closest("[data-action]");
  if (action?.dataset.action === "join") {
    if (!currentUser) {
      openAccountModal();
      showToast("Sign in to join this project.");
      return;
    }
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
document.querySelector("#account-button").addEventListener("click", openAccountModal);
document.querySelector("#account-close").addEventListener("click", () => (accountModal.hidden = true));
welcomeClose?.addEventListener("click", dismissWelcomeModal);
welcomeStart?.addEventListener("click", dismissWelcomeModal);
document.querySelector("#sign-out-button").addEventListener("click", async () => {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  currentUser = null;
  currentProfile = null;
  renderAccountState();
  accountModal.hidden = true;
  showToast("You have signed out.");
});

document.querySelectorAll("[data-auth-mode]").forEach((button) => {
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});

accountForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) {
    showToast("Supabase is not available yet. Check your internet connection.");
    return;
  }

  const data = new FormData(accountForm);
  const email = data.get("email").trim();
  const password = data.get("password");
  const displayName = data.get("display_name")?.trim();
  const neighbourhoodId = data.get("neighbourhood_id");

  accountSubmit.disabled = true;
  accountSubmit.textContent = authMode === "signup" ? "Creating…" : "Signing in…";

  if (authMode === "signup") {
    if (!displayName || !neighbourhoodId) {
      showToast("Add your name and choose your neighbourhood.");
      accountSubmit.disabled = false;
      accountSubmit.textContent = "Create account";
      return;
    }

    const { data: signupData, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: authRedirectUrl(),
        data: {
          display_name: displayName,
          neighbourhood_id: neighbourhoodId,
        },
      },
    });

    if (error) {
      showToast(error.message);
    } else {
      currentUser = signupData.user || null;
      if (signupData.session && currentUser) {
        await supabaseClient
          .from("profiles")
          .update({ display_name: displayName, neighbourhood_id: neighbourhoodId })
          .eq("id", currentUser.id);
        currentProfile = await loadProfile(currentUser.id);
        await loadLiveProjects();
        showToast("Your Colabourhood account is ready.");
      } else {
        showToast("Check your email to confirm your account.");
      }
      accountForm.reset();
      renderAccountState();
    }
  } else {
    const { data: signinData, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message?.toLowerCase().includes("email not confirmed")) {
        try {
          await resendSignupConfirmation(email);
          showToast("Email not confirmed. We sent a fresh confirmation link.");
        } catch (resendError) {
          showToast(resendError.message || "Email not confirmed. Please request a new confirmation email.");
        }
      } else {
        showToast(error.message);
      }
    } else {
      currentUser = signinData.user;
      currentProfile = await loadProfile(currentUser.id);
      await loadLiveProjects();
      accountForm.reset();
      accountModal.hidden = true;
      renderAccountState();
      showToast("You are signed in.");
    }
  }

  accountSubmit.disabled = false;
  accountSubmit.textContent = authMode === "signup" ? "Create account" : "Sign in";
});

map.on("click", (event) => {
  if (placing) openProjectForm(event.latlng);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) {
    openAccountModal();
    showToast("Sign in before proposing a project.");
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  const title = data.get("title").trim();
  const description = data.get("description").trim();
  const location = pendingLocation || L.latLng(NEIGHBOURHOOD_CENTER);

  const liveProjectDraft = {
    id: `pending-${Date.now()}`,
    scope: proposalScope,
    title,
    shortTitle: shortTitle(title),
    location: proposalScope === "neighbourhood" ? `Across ${activeNeighbourhoodName()}` : activeNeighbourhoodName(),
    status: "proposed",
    neighbours: 1,
    description,
    ...(proposalScope === "place" ? { lat: location.lat, lng: location.lng } : {}),
  };

  submitButton.disabled = true;
  submitButton.textContent = "Saving…";

  try {
    const savedProject = await saveLiveProject(liveProjectDraft);
    selectedId = savedProject.id;
    currentFilter = "all";
    document.querySelectorAll(".filter").forEach((button) =>
      button.classList.toggle("active", button.dataset.filter === "all")
    );
    form.reset();
    modal.hidden = true;
    if (pendingMarker) map.removeLayer(pendingMarker);
    pendingMarker = null;
    pendingLocation = null;
    await loadLiveProjects();
    if (liveProjectDraft.scope === "neighbourhood") {
      map.fitBounds(NEIGHBOURHOOD_BOUNDS, { padding: [28, 28] });
    } else {
      map.panTo([liveProjectDraft.lat, liveProjectDraft.lng]);
    }
    showToast("Your proposed project is now saved on the neighbourhood map.");
  } catch (error) {
    showToast(error.message || "Could not save this project yet.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Continue";
  }
  return;

  const project = {
    id: Date.now(),
    scope: proposalScope,
    title,
    shortTitle: title.length > 22 ? `${title.slice(0, 21)}…` : title,
    location: proposalScope === "neighbourhood" ? `Across ${PILOT_NEIGHBOURHOOD_NAME}` : PILOT_NEIGHBOURHOOD_NAME,
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
    accountModal.hidden = true;
    dismissWelcomeModal();
    cancelLocationChoice();
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 760) mobileDrawerOpen = true;
  renderDrawer();
  map.invalidateSize();
});

window.setTimeout(() => map.invalidateSize(), 0);

async function initApp() {
  setAuthMode("signup");
  render();
  await loadNeighbourhoods();
  await refreshSession();
  await loadLiveProjects();
  showWelcomeModalIfNeeded();
  if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session?.user || null;
      currentProfile = currentUser ? await loadProfile(currentUser.id) : null;
      renderAccountState();
      await loadLiveProjects();
    });
  }
}

initApp();
