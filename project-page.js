const PROJECT_STATUS = {
  proposed: { color: "#5d8390" },
  gathering: { color: "#d75f48" },
  ready: { color: "#efc75e" },
  completed: { color: "#235b49" }
};

const pathParts = location.pathname.split("/").filter(Boolean);
const lastPathPart = pathParts[pathParts.length - 1];
const slug = (lastPathPart === "index.html" ? pathParts[pathParts.length - 2] : lastPathPart) || "safer-crossing-ballinacurra-gardens";
const project = window.COLABOURHOOD_PROJECTS[slug] || window.COLABOURHOOD_PROJECTS["safer-crossing-ballinacurra-gardens"];
const root = document.querySelector("#project-app");
let supported = false;
let activeSection = "overview";
document.title = `${project.title} · Colabourhood`;

const icon = (name) => {
  const icons = {
    pin: '<path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/>',
    area: '<path d="M4 8.5 12 4l8 4.5v9L12 22l-8-4.5v-9Z"/><path d="m4 8.5 8 4.5 8-4.5M12 13v9"/>',
    arrow: '<path d="m9 18 6-6-6-6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    paperclip: '<path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 0 1-2.8-2.8l8.9-8.9"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
};

function render() {
  const percent = project.funding.goal ? Math.min(100, Math.round(project.funding.pledged / project.funding.goal * 100)) : 0;
  root.style.setProperty("--project-status", PROJECT_STATUS[project.statusKey].color);
  root.innerHTML = `
    <header class="project-site-header">
      <a class="project-brand" href="../../index.html" aria-label="Colabourhood home">
        <img src="../../assets/brand/colabourhood-logo.png" alt="Colabourhood">
      </a>
      <nav><a href="../../index.html">Map</a><a class="active" href="#">Projects</a><a href="../../index.html#neighbourhood">Neighbourhood</a></nav>
      <a class="header-map-link" href="../../index.html">${icon("pin")}Back to map</a>
    </header>

    <main>
      <section class="project-hero">
        <div class="project-hero-main">
          <a class="back-link" href="../../index.html">← Back to neighbourhood map</a>
          <div class="project-status"><i></i>${project.status}</div>
          <h1>${project.title}</h1>
          <p class="project-objective">${project.objective}</p>
          <div class="project-meta">
            <span>${icon(project.scope === "neighbourhood" ? "area" : "pin")}${project.location}</span>
            <span>${icon("people")}Organised by ${project.organiser}</span>
          </div>
        </div>
        <aside class="hero-action">
          <strong>${project.neighbours} neighbours involved</strong>
          <p>${project.statusKey === "completed" ? "This project has been completed and its record remains open." : "Your support helps this project move to its next stage."}</p>
          <button class="stage-action" id="support-action">${supported ? "You support this" : project.statusKey === "proposed" ? "Support this idea" : project.statusKey === "ready" ? "Join the action" : project.statusKey === "completed" ? "View the outcome" : "Support this idea"}</button>
          <button class="secondary-action" data-open-help>Offer help</button>
        </aside>
      </section>

      <nav class="section-nav" aria-label="Project sections">
        ${["overview", "action-plan", "people-resources", "updates"].map((section) => `<a href="#${section}" data-section="${section}" class="${activeSection === section ? "active" : ""}">${({overview:"Overview","action-plan":"Action plan","people-resources":"People & resources",updates:"Updates"})[section]}</a>`).join("")}
      </nav>

      <div class="project-layout">
        <div class="project-content">
          <section id="overview" class="page-section">
            <h2>Overview</h2>
            <p class="lead">${project.description}</p>
            <div class="media-gallery">
              <button class="media-main" data-media="../../assets/projects/${project.media[0]}"><img src="../../assets/projects/${project.media[0]}" alt="Illustrative resident evidence for this project"><span>Illustrative project evidence</span></button>
              <div class="media-side">
                <button data-media="../../assets/projects/${project.media[1]}"><img src="../../assets/projects/${project.media[1]}" alt="Supporting project evidence"></button>
                <button data-media="../../assets/projects/${project.media[2]}"><img src="../../assets/projects/${project.media[2]}" alt="Supporting project evidence"></button>
              </div>
            </div>
            <div class="why-block"><h3>Why this matters</h3><p>${project.why}</p></div>
            <div class="project-map-block"><div id="project-mini-map"></div><div><strong>${project.scope === "neighbourhood" ? "Neighbourhood-wide" : project.location}</strong><p>${project.scope === "neighbourhood" ? "This project applies across the pilot area rather than to a single pin." : "The mapped point shows the place this project is focused on."}</p></div></div>
          </section>

          <section id="action-plan" class="page-section ruled-section">
            <div class="section-heading"><div><h2>Action plan</h2><p>What has happened, what comes next and who owns each step.</p></div></div>
            <div class="milestone-list">${project.milestones.map(([state, title, owner, date]) => `<article class="milestone ${state}"><span class="milestone-state">${state === "complete" ? icon("check") : state === "active" ? icon("clock") : ""}</span><div><strong>${title}</strong><small>${owner}</small></div><time>${date}</time></article>`).join("")}</div>
            <div class="needs-block"><h3>What we need now</h3><div class="needs-list">${project.needs.map(([name, detail]) => `<div><strong>${name}</strong><span>${detail}</span><button data-open-help>Offer</button></div>`).join("")}</div></div>
          </section>

          <section id="people-resources" class="page-section">
            <div class="section-heading"><div><h2>People & resources</h2><p>Concrete commitments, with neighbour privacy respected.</p></div></div>
            <div class="supporter-strip">${project.supporters.map((name, index) => `<div class="supporter"><i style="--avatar:${["#d8b8a1","#99b4a2","#e4cc78","#a8bdca"][index % 4]}">${name.includes("private") ? "•••" : name.split(" ").map(part => part[0]).join("").slice(0,2)}</i><span>${name}</span></div>`).join("")}</div>
            <div class="commitment-grid">${project.commitments.map(([number, label]) => `<div><strong>${number}</strong><span>${label}</span></div>`).join("")}</div>
            <div class="funding-ledger">
              <div class="funding-summary">
                <h3>Shared funding</h3>
                ${project.funding.goal ? `<strong>€${project.funding.pledged.toLocaleString()} <small>pledged of €${project.funding.goal.toLocaleString()}</small></strong><div class="funding-progress"><i style="width:${percent}%"></i></div>` : `<strong>No shared budget yet</strong><p>This project is currently organising interest and quotes.</p>`}
                <dl><div><dt>Received</dt><dd>€${project.funding.received.toLocaleString()}</dd></div><div><dt>Spent</dt><dd>€${project.funding.spent.toLocaleString()}</dd></div></dl>
                ${project.funding.goal ? '<button class="stage-action compact" id="pledge-action">Make a pledge</button>' : ""}
              </div>
              <div class="expense-list"><h3>Expenses and receipts</h3>${project.expenses.length ? project.expenses.map(([name, amount, receipt]) => `<div><span>${name}</span><strong>${amount}</strong><a href="#" data-receipt>${receipt}</a></div>`).join("") : '<p class="empty-copy">No project money has been spent.</p>'}</div>
            </div>
          </section>

          <section id="updates" class="page-section ruled-section">
            <div class="section-heading"><div><h2>Updates</h2><p>A durable record of progress, decisions and evidence.</p></div><button class="secondary-action small" id="add-update">Post an update</button></div>
            <div class="update-list">${project.updates.map(([date, author, title, text, attachment]) => `<article class="update"><time>${date}</time><div><span>${author}</span><h3>${title}</h3><p>${text}</p><a href="#" data-receipt>${icon("paperclip")}${attachment}</a></div></article>`).join("")}</div>
          </section>
        </div>

        <aside class="project-side-rail">
          <div class="side-block"><span>Current stage</span><strong>${project.status}</strong><p>${project.statusKey === "gathering" ? "Gather enough commitment to agree the plan and move into action." : project.statusKey === "ready" ? "The plan is ready. Neighbours can now commit to delivery." : project.statusKey === "completed" ? "The work is complete and the record is public." : "Test whether enough neighbours want to develop this idea."}</p></div>
          <div class="side-block"><span>Ways to contribute</span><div class="help-options">${["Time","Skills","Tools","Funds"].map(type => `<button data-help="${type}">${type}</button>`).join("")}</div></div>
          <div class="side-block privacy-note"><span>Neighbour privacy</span><p>Residents choose whether their name appears publicly. Private support still counts toward totals.</p></div>
        </aside>
      </div>
    </main>

    <div class="project-modal-backdrop" id="help-modal" hidden><section class="project-dialog"><button class="dialog-close" aria-label="Close">×</button><h2>Offer help</h2><p>Choose what you can contribute. You can decide later whether your name is public.</p><div class="dialog-options">${["Time","Skills","Tools","Funds"].map(type => `<button data-dialog-help="${type}">${type}</button>`).join("")}</div><button class="stage-action" id="save-help">Save my offer</button></section></div>
    <div class="project-modal-backdrop" id="media-modal" hidden><section class="media-dialog"><button class="dialog-close" aria-label="Close">×</button><img alt="Expanded project evidence"></section></div>
    <div class="project-toast" role="status" hidden></div>
  `;
  initialisePage(percent);
}

function initialisePage() {
  const map = L.map("project-mini-map", { zoomControl: false, attributionControl: true, dragging: false, scrollWheelZoom: false });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
  if (project.scope === "place") {
    map.setView([project.lat, project.lng], 17);
    L.circleMarker([project.lat, project.lng], { radius: 9, color: "#fff", weight: 3, fillColor: PROJECT_STATUS[project.statusKey].color, fillOpacity: 1 }).addTo(map);
  } else {
    const bounds = [[52.6432195,-8.6386079],[52.6477796,-8.6313332]];
    map.fitBounds(bounds);
    L.rectangle(bounds, { color: PROJECT_STATUS[project.statusKey].color, weight: 3, fillOpacity: .12 }).addTo(map);
  }

  document.querySelector("#support-action").addEventListener("click", (event) => {
    if (project.statusKey === "completed") return document.querySelector("#updates").scrollIntoView({ behavior: "smooth" });
    supported = !supported;
    event.currentTarget.textContent = supported ? "You support this" : "Support this idea";
    toast(supported ? "Your support has been recorded." : "Your support has been removed.");
  });
  document.querySelectorAll("[data-open-help]").forEach(button => button.addEventListener("click", () => document.querySelector("#help-modal").hidden = false));
  document.querySelectorAll("[data-help]").forEach(button => button.addEventListener("click", () => { document.querySelector("#help-modal").hidden = false; const target = document.querySelector(`[data-dialog-help="${button.dataset.help}"]`); target?.classList.add("selected"); }));
  document.querySelectorAll("[data-dialog-help]").forEach(button => button.addEventListener("click", () => button.classList.toggle("selected")));
  document.querySelector("#save-help").addEventListener("click", () => { document.querySelector("#help-modal").hidden = true; toast("Your offer has been saved."); });
  document.querySelectorAll(".dialog-close").forEach(button => button.addEventListener("click", () => button.closest(".project-modal-backdrop").hidden = true));
  document.querySelectorAll("[data-media]").forEach(button => button.addEventListener("click", () => { const modal = document.querySelector("#media-modal"); modal.querySelector("img").src = button.dataset.media; modal.hidden = false; }));
  document.querySelectorAll("[data-receipt]").forEach(link => link.addEventListener("click", event => { event.preventDefault(); toast("Document preview is available in the next backend-connected version."); }));
  document.querySelector("#pledge-action")?.addEventListener("click", () => toast("Pledge flow opened — no payment is taken in this prototype."));
  document.querySelector("#add-update").addEventListener("click", () => toast("Only project organisers can publish updates."));
  document.querySelectorAll("[data-section]").forEach(link => link.addEventListener("click", () => {
    document.querySelectorAll("[data-section]").forEach(item => item.classList.remove("active"));
    link.classList.add("active");
  }));
}

function toast(message) {
  const element = document.querySelector(".project-toast");
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.hidden = true, 2600);
}

render();
