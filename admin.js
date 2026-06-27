const adminSupabase = window.COLABOURHOOD_SUPABASE;
const adminApp = document.querySelector("#admin-app");
let adminUser = null;
let adminProfile = null;
let reports = [];
let newestProjects = [];
let newestMessages = [];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[character]));
}

function reasonLabel(reason) {
  return {
    inappropriate: "Inappropriate content",
    private_information: "Private information",
    spam_duplicate: "Spam or duplicate",
    unsafe: "Unsafe proposal",
    abuse: "Abusive behaviour",
    other: "Other",
  }[reason] || reason;
}

async function loadAdminData() {
  const { data: sessionData } = await adminSupabase.auth.getSession();
  adminUser = sessionData.session?.user || null;
  if (!adminUser) throw new Error("Sign in before opening the admin dashboard.");

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("id, display_name, is_admin")
    .eq("id", adminUser.id)
    .single();
  if (profileError) throw profileError;
  adminProfile = profile;
  if (!adminProfile?.is_admin) throw new Error("This account is not an admin.");

  const [reportResult, projectResult, messageResult] = await Promise.all([
    adminSupabase
      .from("content_reports")
      .select("id, target_type, target_id, project_id, reason, details, status, created_at, reported_by")
      .order("created_at", { ascending: false })
      .limit(50),
    adminSupabase
      .from("projects")
      .select("id, title, status, is_hidden, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    adminSupabase
      .from("project_messages")
      .select("id, project_id, body, is_hidden, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (reportResult.error) throw reportResult.error;
  reports = reportResult.data || [];
  newestProjects = projectResult.data || [];
  newestMessages = messageResult.data || [];
}

function renderAdmin() {
  adminApp.innerHTML = `
    <section class="admin-hero">
      <p>Admin</p>
      <h1>Reports and moderation</h1>
      <span>Signed in as ${escapeHtml(adminProfile.display_name || adminUser.email)}</span>
    </section>
    <div class="admin-grid">
      <section class="admin-panel">
        <header>
          <h2>Reports</h2>
          <select id="report-filter">
            <option value="open">Open</option>
            <option value="reviewing">Reviewing</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
            <option value="all">All</option>
          </select>
        </header>
        <div class="report-list" id="report-list"></div>
      </section>
      <aside class="admin-panel">
        <header><h2>Newest content</h2></header>
        <div class="admin-list">
          ${newestProjects.map((project) => `
            <article class="admin-row">
              <h3>${escapeHtml(project.title)}</h3>
              <p>${project.is_hidden ? "Hidden" : project.status} · ${new Date(project.created_at).toLocaleDateString("en-IE")}</p>
              <div class="admin-actions">
                <a href="./live-project.html?id=${project.id}">Open</a>
                <button data-hide-project="${project.id}" class="${project.is_hidden ? "" : "danger"}">${project.is_hidden ? "Restore" : "Hide"}</button>
              </div>
            </article>
          `).join("")}
        </div>
      </aside>
    </div>
    <section class="admin-panel" style="margin-top:24px">
      <header><h2>Newest updates</h2></header>
      <div class="admin-list">
        ${newestMessages.length ? newestMessages.map((message) => `
          <article class="admin-row">
            <h3>Project update</h3>
            <p>${escapeHtml(message.body.slice(0, 180))}${message.body.length > 180 ? "…" : ""}</p>
            <div class="admin-actions">
              <a href="./live-project.html?id=${message.project_id}#updates">Open project</a>
              <button data-hide-message="${message.id}" class="${message.is_hidden ? "" : "danger"}">${message.is_hidden ? "Restore" : "Hide"}</button>
            </div>
          </article>
        `).join("") : '<p class="empty-admin">No updates yet.</p>'}
      </div>
    </section>
    <div class="admin-toast" id="admin-toast" role="status" hidden></div>
  `;
  renderReportList("open");
  bindAdminEvents();
}

function renderReportList(filter = "open") {
  const list = document.querySelector("#report-list");
  const visible = filter === "all" ? reports : reports.filter((report) => report.status === filter);
  list.innerHTML = visible.length ? visible.map((report) => `
    <article class="report-card">
      <div class="report-meta">
        <span>${escapeHtml(report.target_type)}</span>
        <span>${escapeHtml(report.status)}</span>
        <span>${new Date(report.created_at).toLocaleString("en-IE")}</span>
      </div>
      <h3>${escapeHtml(reasonLabel(report.reason))}</h3>
      <p>${escapeHtml(report.details || "No extra detail provided.")}</p>
      <div class="admin-actions">
        ${report.project_id ? `<a href="./live-project.html?id=${report.project_id}">Open project</a>` : ""}
        <button class="primary" data-report-status="${report.id}" data-status="reviewing">Reviewing</button>
        <button data-report-status="${report.id}" data-status="resolved">Resolved</button>
        <button data-report-status="${report.id}" data-status="dismissed">Dismiss</button>
        ${report.target_type === "project" ? `<button class="danger" data-hide-project="${report.target_id}">Hide project</button>` : ""}
        ${report.target_type === "message" ? `<button class="danger" data-hide-message="${report.target_id}">Hide update</button>` : ""}
        ${report.target_type === "media" ? `<button class="danger" data-hide-media="${report.target_id}">Hide photo</button>` : ""}
      </div>
    </article>
  `).join("") : '<p class="empty-admin">No reports in this view.</p>';
}

function bindAdminEvents() {
  document.querySelector("#report-filter").addEventListener("change", (event) => renderReportList(event.target.value));
  adminApp.addEventListener("click", async (event) => {
    const statusButton = event.target.closest("[data-report-status]");
    const projectButton = event.target.closest("[data-hide-project]");
    const messageButton = event.target.closest("[data-hide-message]");
    const mediaButton = event.target.closest("[data-hide-media]");

    try {
      if (statusButton) {
        await updateReportStatus(statusButton.dataset.reportStatus, statusButton.dataset.status);
        await refreshAdmin();
        toast("Report updated.");
      }
      if (projectButton) {
        await toggleHidden("projects", projectButton.dataset.hideProject);
        await refreshAdmin();
        toast("Project visibility updated.");
      }
      if (messageButton) {
        await toggleHidden("project_messages", messageButton.dataset.hideMessage);
        await refreshAdmin();
        toast("Update visibility updated.");
      }
      if (mediaButton) {
        await toggleHidden("project_media", mediaButton.dataset.hideMedia);
        await refreshAdmin();
        toast("Photo visibility updated.");
      }
    } catch (error) {
      toast(error.message || "Admin action failed.");
    }
  });
}

async function updateReportStatus(id, status) {
  const { error } = await adminSupabase
    .from("content_reports")
    .update({
      status,
      reviewed_by: adminUser.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

async function toggleHidden(table, id) {
  const { data, error: readError } = await adminSupabase.from(table).select("is_hidden").eq("id", id).single();
  if (readError) throw readError;
  const { error } = await adminSupabase.from(table).update({ is_hidden: !data.is_hidden }).eq("id", id);
  if (error) throw error;
}

async function refreshAdmin() {
  await loadAdminData();
  renderAdmin();
}

function toast(message) {
  const element = document.querySelector("#admin-toast");
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    element.hidden = true;
  }, 2500);
}

async function initAdmin() {
  try {
    if (!adminSupabase) throw new Error("Supabase is not available.");
    await loadAdminData();
    renderAdmin();
  } catch (error) {
    adminApp.innerHTML = `
      <section class="admin-hero">
        <p>Admin</p>
        <h1>Admin access needed</h1>
        <span>${escapeHtml(error.message)}</span>
      </section>
      <section class="admin-panel"><div class="empty-admin">Sign in with an admin account, then ask a database owner to set <code>profiles.is_admin = true</code> for that account.</div></section>
    `;
  }
}

initAdmin();
