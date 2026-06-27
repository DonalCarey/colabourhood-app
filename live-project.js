const LIVE_STATUS = {
  proposed: { label: "Proposed", key: "proposed", color: "#5d8390" },
  gathering_support: { label: "Gathering support", key: "gathering", color: "#d75f48" },
  planning: { label: "Planning", key: "ready", color: "#efc75e" },
  active: { label: "Ready to act", key: "ready", color: "#efc75e" },
  completed: { label: "Completed", key: "completed", color: "#235b49" },
  paused: { label: "Paused", key: "proposed", color: "#5d8390" },
};

const LIVE_CONTRIBUTION_LABELS = {
  support: "Supports",
  help: "Can help",
  organise: "Can organise",
  materials: "Materials",
  funding: "Funding pledges",
};

const LIVE_HELP_TYPES = {
  Time: "help",
  Skills: "help",
  Tools: "materials",
  Funds: "funding",
};

const liveSupabase = window.COLABOURHOOD_SUPABASE;
const app = document.querySelector("#live-project-app");
const params = new URLSearchParams(window.location.search);
const projectId = params.get("id");
let currentUser = null;
let project = null;
let neighbourhood = null;
let contributions = [];
let messages = [];
let supported = false;

const icon = (name) => {
  const icons = {
    pin: '<path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/>',
    area: '<path d="M4 8.5 12 4l8 4.5v9L12 22l-8-4.5v-9Z"/><path d="m4 8.5 8 4.5 8-4.5M12 13v9"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    paperclip: '<path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 0 1-2.8-2.8l8.9-8.9"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[character]));
}

function statusMeta(status) {
  return LIVE_STATUS[status] || LIVE_STATUS.proposed;
}

function projectScope(row) {
  return row.project_type === "neighbourhood_wide" ? "neighbourhood" : "place";
}

function projectLocationLabel() {
  if (!project) return "";
  if (projectScope(project) === "neighbourhood") return `Across ${neighbourhood?.name || "the neighbourhood"}`;
  return project.location_label || neighbourhood?.name || "Mapped location";
}

function contributionCount(type) {
  return contributions.filter((item) => item.contribution_type === type).length;
}

function contributionAmount() {
  return contributions
    .filter((item) => item.contribution_type === "funding")
    .reduce((sum, item) => sum + Number(item.pledge_amount || 0), 0);
}

function userSupportsProject() {
  return Boolean(currentUser && contributions.some((item) => item.user_id === currentUser.id && item.contribution_type === "support"));
}

async function getCurrentUser() {
  if (!liveSupabase) return null;
  const { data } = await liveSupabase.auth.getSession();
  return data.session?.user || null;
}

async function loadProject() {
  if (!liveSupabase) throw new Error("Supabase is not available.");
  if (!projectId) throw new Error("No project id was provided.");

  const { data: projectRow, error: projectError } = await liveSupabase
    .from("projects")
    .select("id, neighbourhood_id, created_by, title, summary, description, project_type, status, location_lat, location_lng, location_label, funding_target, created_at")
    .eq("id", projectId)
    .eq("is_hidden", false)
    .single();

  if (projectError) throw projectError;
  project = projectRow;

  const [{ data: neighbourhoodRows }, { data: contributionRows }, { data: messageRows }] = await Promise.all([
    liveSupabase.from("neighbourhoods").select("id, name, city, country, centre_lat, centre_lng").eq("id", project.neighbourhood_id).single(),
    liveSupabase
      .from("project_contributions")
      .select("id, project_id, user_id, contribution_type, pledge_amount, note, is_public, created_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false }),
    liveSupabase
      .from("project_messages")
      .select("id, user_id, message_type, body, created_at")
      .eq("project_id", project.id)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false }),
  ]);

  neighbourhood = neighbourhoodRows || null;
  contributions = contributionRows || [];
  messages = messageRows || [];
  supported = userSupportsProject();
}

async function saveContribution(type, extra = {}) {
  if (!currentUser) {
    toast("Sign in on the map page before contributing.");
    return false;
  }

  const payload = {
    project_id: project.id,
    user_id: currentUser.id,
    contribution_type: type,
    is_public: true,
    ...extra,
  };

  const { error } = await liveSupabase
    .from("project_contributions")
    .upsert(payload, { onConflict: "project_id,user_id,contribution_type" });

  if (error) throw error;
  await loadProject();
  render();
  return true;
}

async function saveMessage(body) {
  if (!currentUser) {
    toast("Sign in on the map page before posting an update.");
    return false;
  }

  const { error } = await liveSupabase.from("project_messages").insert({
    project_id: project.id,
    user_id: currentUser.id,
    message_type: "comment",
    body,
  });

  if (error) throw error;
  await loadProject();
  render();
  return true;
}

function renderError(error) {
  app.innerHTML = `
    <header class="project-site-header">
      <a class="project-brand" href="./index.html" aria-label="Colabourhood home">
        <img src="./assets/brand/colabourhood-logo.png" alt="Colabourhood">
      </a>
      <a class="header-map-link" href="./index.html">Back to map</a>
    </header>
    <main>
      <section class="live-error">
        <h1>We could not open this project</h1>
        <p>${escapeHtml(error.message || "The project may have been removed or the link may be incomplete.")}</p>
        <div class="live-action-row">
          <a class="header-map-link" href="./index.html">Return to the map</a>
        </div>
      </section>
    </main>
  `;
}

function render() {
  const status = statusMeta(project.status);
  const scope = projectScope(project);
  const supporterCount = Math.max(1, contributionCount("support"));
  const pledgeAmount = contributionAmount();
  const fundingTarget = Number(project.funding_target || 0);
  const fundingPercent = fundingTarget ? Math.min(100, Math.round((pledgeAmount / fundingTarget) * 100)) : 0;
  const created = new Date(project.created_at).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
  document.title = `${project.title} · Colabourhood`;

  app.style.setProperty("--project-status", status.color);
  app.innerHTML = `
    <header class="project-site-header">
      <a class="project-brand" href="./index.html" aria-label="Colabourhood home">
        <img src="./assets/brand/colabourhood-logo.png" alt="Colabourhood">
      </a>
      <nav><a href="./index.html">Map</a><a class="active" href="./index.html#projects">Projects</a><a href="./index.html#neighbourhood">Neighbourhood</a></nav>
      <a class="header-map-link" href="./index.html">${icon("pin")}Back to map</a>
    </header>

    <main>
      <section class="project-hero">
        <div class="project-hero-main">
          <a class="back-link" href="./index.html">← Back to neighbourhood map</a>
          <div class="project-status"><i></i>${status.label}</div>
          <h1>${escapeHtml(project.title)}</h1>
          <p class="project-objective">${escapeHtml(project.summary || project.description)}</p>
          <div class="project-meta">
            <span>${icon(scope === "neighbourhood" ? "area" : "pin")}${escapeHtml(projectLocationLabel())}</span>
            <span>${icon("people")}${supporterCount} neighbour${supporterCount === 1 ? "" : "s"} involved</span>
          </div>
        </div>
        <aside class="hero-action">
          <strong>${supporterCount} neighbour${supporterCount === 1 ? "" : "s"} involved</strong>
          <p>${supported ? "You are already supporting this project." : "Your support helps this project move to its next stage."}</p>
          <button class="stage-action" id="support-action">${supported ? "You support this" : "Support this idea"}</button>
          <button class="secondary-action" data-open-help>Offer help</button>
        </aside>
      </section>

      <nav class="section-nav" aria-label="Project sections">
        <a class="active" href="#overview" data-section>Overview</a>
        <a href="#action-plan" data-section>Action plan</a>
        <a href="#people-resources" data-section>People & resources</a>
        <a href="#updates" data-section>Updates</a>
      </nav>

      <div class="project-layout">
        <div class="project-content">
          <section id="overview" class="page-section">
            <h2>Overview</h2>
            <p class="lead">${escapeHtml(project.description)}</p>
            <div class="why-block">
              <h3>Why this matters</h3>
              <p>This page is a shared record for neighbours: what is being proposed, who supports it, what help is available, and what progress has been made.</p>
            </div>
            <div class="project-map-block">
              <div id="project-mini-map" class="live-map-shell"></div>
              <div>
                <strong>${escapeHtml(scope === "neighbourhood" ? "Neighbourhood-wide project" : projectLocationLabel())}</strong>
                <p>${scope === "neighbourhood" ? `This project applies across ${escapeHtml(neighbourhood?.name || "the neighbourhood")}.` : "The mapped point shows the place this project is focused on."}</p>
              </div>
            </div>
          </section>

          <section id="action-plan" class="page-section ruled-section">
            <div class="section-heading"><div><h2>Action plan</h2><p>A simple starting plan for turning this proposal into real-world action.</p></div></div>
            <div class="milestone-list">
              ${[
                ["complete", "Project proposed", "Project proposer", created],
                [supporterCount > 1 ? "active" : "pending", "Gather neighbour support", "Local residents", "Now"],
                ["pending", "Agree the next action", "Project supporters", "Next"],
                ["pending", "Publish an update", "Project organiser", "When ready"],
              ].map(([state, title, owner, date]) => `<article class="milestone ${state}"><span class="milestone-state">${state === "complete" ? icon("check") : state === "active" ? icon("clock") : ""}</span><div><strong>${title}</strong><small>${owner}</small></div><time>${date}</time></article>`).join("")}
            </div>
            <div class="needs-block"><h3>What we need now</h3><div class="needs-list">
              <div><strong>More neighbours</strong><span>People willing to support the idea and shape the first decision.</span><button data-open-help>Offer</button></div>
              <div><strong>Practical help</strong><span>Time, skills, local knowledge, tools or materials.</span><button data-open-help>Offer</button></div>
              <div><strong>Updates</strong><span>A short public record when something changes.</span><button id="focus-update">Add</button></div>
            </div></div>
          </section>

          <section id="people-resources" class="page-section">
            <div class="section-heading"><div><h2>People & resources</h2><p>Support and pledges connected to this project.</p></div></div>
            <div class="commitment-grid">
              <div><strong>${supporterCount}</strong><span>supporting</span></div>
              <div><strong>${contributionCount("help")}</strong><span>offers of help</span></div>
              <div><strong>${contributionCount("materials")}</strong><span>materials/tools</span></div>
              <div><strong>€${pledgeAmount.toLocaleString()}</strong><span>pledged</span></div>
            </div>
            <div class="funding-ledger">
              <div class="funding-summary">
                <h3>Shared funding</h3>
                ${fundingTarget ? `<strong>€${pledgeAmount.toLocaleString()} <small>pledged of €${fundingTarget.toLocaleString()}</small></strong><div class="funding-progress"><i style="width:${fundingPercent}%"></i></div>` : `<strong>€${pledgeAmount.toLocaleString()} pledged</strong><p class="live-funding-note">No funding target has been set yet. Pledges are expressions of intent only; no payment is taken.</p>`}
                <button class="stage-action compact" id="pledge-action">Record a pledge</button>
              </div>
              <div class="expense-list"><h3>Recent support</h3>${renderContributionList()}</div>
            </div>
          </section>

          <section id="updates" class="page-section ruled-section">
            <div class="section-heading"><div><h2>Updates</h2><p>A durable record of comments, progress and decisions.</p></div></div>
            <form class="live-message-form" id="message-form">
              <label for="message-body">Add a comment or update</label>
              <textarea id="message-body" name="body" required placeholder="Share a useful update, offer context, or suggest a next step."></textarea>
              <button class="stage-action" type="submit">Post update</button>
            </form>
            <div class="update-list">${renderMessages()}</div>
          </section>
        </div>

        <aside class="project-side-rail">
          <div class="side-block"><span>Current stage</span><strong>${status.label}</strong><p>This project is live in Supabase and can be updated as neighbours contribute.</p></div>
          <div class="side-block"><span>Ways to contribute</span><div class="help-options">${["Time", "Skills", "Tools", "Funds"].map(type => `<button data-help="${type}">${type}</button>`).join("")}</div></div>
          <div class="side-block privacy-note"><span>Neighbour privacy</span><p>Support can be counted without showing personal details publicly.</p></div>
        </aside>
      </div>
    </main>

    <div class="project-modal-backdrop" id="help-modal" hidden><section class="project-dialog"><button class="dialog-close" aria-label="Close">×</button><h2>Offer help</h2><p>Choose what you can contribute. Funding is recorded as a pledge only; no payment is taken.</p><div class="dialog-options">${["Time","Skills","Tools","Funds"].map(type => `<button data-dialog-help="${type}">${type}</button>`).join("")}</div><button class="stage-action" id="save-help">Save my offer</button></section></div>
    <div class="project-modal-backdrop" id="pledge-modal" hidden><section class="project-dialog"><button class="dialog-close" aria-label="Close">×</button><h2>Record a pledge</h2><p>This records intent only. No money is collected.</p><label>Amount in euro<input id="pledge-amount" type="number" min="1" step="1" placeholder="25"></label><button class="stage-action compact" id="save-pledge">Save pledge</button></section></div>
    <div class="project-toast" role="status" hidden></div>
  `;

  initialisePage();
}

function renderContributionList() {
  if (!contributions.length) return '<p class="live-empty-state">No support has been recorded yet.</p>';
  return contributions.slice(0, 8).map((item) => {
    const label = LIVE_CONTRIBUTION_LABELS[item.contribution_type] || "Contribution";
    const detail = item.contribution_type === "funding" ? `€${Number(item.pledge_amount || 0).toLocaleString()}` : "recorded";
    return `<div><span>${label}</span><strong>${detail}</strong><a href="#">${new Date(item.created_at).toLocaleDateString("en-IE")}</a></div>`;
  }).join("");
}

function renderMessages() {
  if (!messages.length) return '<p class="live-empty-state">No updates yet. Be the first neighbour to add useful context.</p>';
  return messages.map((message) => `
    <article class="update">
      <time>${new Date(message.created_at).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}</time>
      <div><span>${message.message_type}</span><h3>Neighbour update</h3><p>${escapeHtml(message.body)}</p><a href="#">${icon("paperclip")}Live Supabase record</a></div>
    </article>
  `).join("");
}

function initialisePage() {
  initialiseMap();
  document.querySelector("#support-action").addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    try {
      await saveContribution("support");
      supported = true;
      toast("Your support has been recorded.");
    } catch (error) {
      toast(error.message || "Could not record support yet.");
    } finally {
      event.currentTarget.disabled = false;
    }
  });

  document.querySelectorAll("[data-open-help]").forEach((button) => button.addEventListener("click", () => document.querySelector("#help-modal").hidden = false));
  document.querySelectorAll("[data-help]").forEach((button) => button.addEventListener("click", () => {
    document.querySelector("#help-modal").hidden = false;
    document.querySelector(`[data-dialog-help="${button.dataset.help}"]`)?.classList.add("selected");
  }));
  document.querySelectorAll("[data-dialog-help]").forEach((button) => button.addEventListener("click", () => button.classList.toggle("selected")));
  document.querySelector("#save-help").addEventListener("click", saveHelpOffers);
  document.querySelector("#pledge-action").addEventListener("click", () => document.querySelector("#pledge-modal").hidden = false);
  document.querySelector("#save-pledge").addEventListener("click", savePledge);
  document.querySelector("#message-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = new FormData(event.currentTarget).get("body").trim();
    if (!body) return;
    try {
      await saveMessage(body);
      toast("Your update has been posted.");
    } catch (error) {
      toast(error.message || "Could not post this update yet.");
    }
  });
  document.querySelector("#focus-update").addEventListener("click", () => document.querySelector("#message-body").focus());
  document.querySelectorAll(".dialog-close").forEach((button) => button.addEventListener("click", () => button.closest(".project-modal-backdrop").hidden = true));
  document.querySelectorAll("[data-section]").forEach((link) => link.addEventListener("click", () => {
    document.querySelectorAll("[data-section]").forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
  }));
}

function initialiseMap() {
  const mapElement = document.querySelector("#project-mini-map");
  if (!mapElement || !window.L) return;

  const miniMap = L.map(mapElement, { zoomControl: false, attributionControl: true, dragging: false, scrollWheelZoom: false });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(miniMap);

  if (projectScope(project) === "place" && project.location_lat && project.location_lng) {
    miniMap.setView([Number(project.location_lat), Number(project.location_lng)], 17);
    L.circleMarker([Number(project.location_lat), Number(project.location_lng)], {
      radius: 9,
      color: "#fff",
      weight: 3,
      fillColor: statusMeta(project.status).color,
      fillOpacity: 1,
    }).addTo(miniMap);
  } else {
    const centre = [Number(neighbourhood?.centre_lat || 52.6454687), Number(neighbourhood?.centre_lng || -8.6362558)];
    miniMap.setView(centre, 15);
    L.circle(centre, {
      radius: 450,
      color: statusMeta(project.status).color,
      weight: 3,
      fillOpacity: .12,
    }).addTo(miniMap);
  }
}

async function saveHelpOffers() {
  const selected = [...document.querySelectorAll("[data-dialog-help].selected")];
  if (!selected.length) {
    toast("Choose at least one way to help.");
    return;
  }

  try {
    for (const button of selected) {
      await saveContribution(LIVE_HELP_TYPES[button.dataset.dialogHelp] || "help", {
        note: button.dataset.dialogHelp,
      });
    }
    document.querySelector("#help-modal").hidden = true;
    toast("Your offer has been saved.");
  } catch (error) {
    toast(error.message || "Could not save your offer yet.");
  }
}

async function savePledge() {
  const amount = Number(document.querySelector("#pledge-amount").value);
  if (!amount || amount < 1) {
    toast("Add a pledge amount first.");
    return;
  }

  try {
    await saveContribution("funding", { pledge_amount: amount });
    document.querySelector("#pledge-modal").hidden = true;
    toast("Your pledge has been recorded.");
  } catch (error) {
    toast(error.message || "Could not save your pledge yet.");
  }
}

function toast(message) {
  const element = document.querySelector(".project-toast");
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    element.hidden = true;
  }, 2800);
}

async function init() {
  try {
    currentUser = await getCurrentUser();
    await loadProject();
    render();
  } catch (error) {
    renderError(error);
  }
}

init();
