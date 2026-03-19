// ─── PRIORITY SCORING ALGORITHM ──────────────────────────────────────────────
function calculatePriorityScore(d) {
  let score = 0;
  const currentYear = 2026;
  const age = currentYear - d.curriculumAdoptionYear;

  // Tier base (max 50 pts)
  if (d.priorityTier === "Tier 1") score += 50;
  else if (d.priorityTier === "Tier 2") score += 35;
  else if (d.priorityTier === "Tier 3") score += 20;

  // Curriculum age bonus (max 25 pts)
  if (age >= 8) score += 25;
  else if (age >= 6) score += 18;
  else if (age >= 4) score += 12;
  else if (age >= 3) score += 6;

  // Buying signals (max 15 pts)
  score += Math.min(d.buyingSignals.length * 3, 15);

  // New leadership bonus (10 pts)
  if (d.newLeadership) score += 10;

  return Math.round(Math.min(score, 100));
}

function getPriorityLabel(score) {
  if (score >= 75) return { label: "🔥 Hot", color: "bg-red-100 text-red-700 border border-red-300" };
  if (score >= 55) return { label: "🌡️ Warm", color: "bg-orange-100 text-orange-700 border border-orange-300" };
  if (score >= 35) return { label: "💧 Cool", color: "bg-blue-100 text-blue-700 border border-blue-300" };
  return { label: "❄️ Cold", color: "bg-gray-100 text-gray-500 border border-gray-200" };
}

// ─── EMAIL TEMPLATES ─────────────────────────────────────────────────────────

function buildContextPersonalization(district) {
  // Pull the richest context snippets for email personalization
  const ctx = district.districtContext || [];
  const signals = district.buyingSignals || [];

  // Prefer strategic context, then funding, then website
  const strategic = ctx.find((c) => c.type === "strategic");
  const funding    = ctx.find((c) => c.type === "funding");
  const website    = ctx.find((c) => c.type === "website");

  // Check signals for useful hooks
  const hasSummer    = signals.some((s) => s.toLowerCase().includes("summer"));
  const hasGrant     = signals.some((s) => s.toLowerCase().includes("grant") || s.toLowerCase().includes("funding"));
  const hasLeadership = signals.some((s) => s.toLowerCase().includes("contact change") || s.toLowerCase().includes("appointed"));

  let hook = "";

  if (strategic) {
    hook = `I came across ${district.district}'s recent strategic priorities around early childhood — it sounds like readiness outcomes are a real focus right now.`;
  } else if (hasSummer) {
    hook = `I noticed ${district.district} has an upcoming summer program — brightwheel's Experience Preschool is designed for exactly that kind of 4–8 week bridge program, with lessons pre-packaged by the day.`;
  } else if (hasGrant) {
    const grantEntry = funding || ctx.find((c) => c.type === "funding");
    if (grantEntry) {
      hook = `I saw that ${district.district} recently received additional early childhood funding — this feels like a great moment to make sure those dollars go as far as possible for VPK students.`;
    } else {
      hook = `With new early childhood funding flowing to districts across Florida, this feels like a timely moment to connect around VPK support.`;
    }
  } else if (website) {
    hook = `I was exploring ${district.district}'s early childhood program page and it's clear your team is investing meaningfully in VPK readiness.`;
  } else if (hasLeadership) {
    hook = `I understand there may have been some recent changes on your early childhood leadership team — I wanted to reach out as you're getting settled.`;
  } else {
    hook = `brightwheel's Experience Preschool is a flexible, play-based curriculum designed to support VPK-to-Kindergarten transitions, with lessons pre-packaged and organized by the day so your team isn't starting from scratch.`;
  }

  return { hook, hasSummer, hasGrant, hasLeadership };
}

// Detect whether a district already uses EC (brightwheel's curriculum)
function districtAlreadyUsesEC(district) {
  const vendor = (district.curriculumVendor || "").toLowerCase();
  const curric = (district.curriculum || "").toLowerCase();
  return vendor.includes("ec") || vendor.includes("experience") ||
         curric.includes("ec") || curric.includes("experience curriculum") ||
         curric.includes("brightwheel");
}

// Detect whether a district has federal funding signals
function districtHasFederalFunding(district) {
  const signals = (district.buyingSignals || []).join(" ").toLowerCase();
  const ctx     = (district.districtContext || []).map((c) => c.summary).join(" ").toLowerCase();
  const notes   = (district.notes || "").toLowerCase();
  return ["title i", "head start", "federal", "esser", "idea", "preschool development grant"]
    .some((kw) => signals.includes(kw) || ctx.includes(kw) || notes.includes(kw));
}

function generateEmail(district, template) {
  // For call-to-confirm contacts, use a role-based greeting instead of a name
  const greeting = district.callToConfirm
    ? `Dear ${district.director},`
    : `Hi ${district.director.split(" ")[0]},`;

  const { hook, hasSummer, hasGrant } = buildContextPersonalization(district);
  const alreadyEC      = districtAlreadyUsesEC(district);
  const hasFedFunding  = districtHasFederalFunding(district);

  const summerLine = hasSummer
    ? `brightwheel's Experience Preschool is especially well-suited for 4–8 week summer bridge programs, with lessons pre-packaged and organized by the day so your team can hit the ground running.`
    : `brightwheel's Experience Preschool is a flexible, play-based curriculum designed to help VPK students build the skills measured in Kindergarten readiness assessments — with pre-packaged daily lessons that many districts use for summer bridge programming.`;

  const signature = `Best,
Christie Cooley
Head of District Partnerships | brightwheel
christie.cooley@mybrightwheel.com | 678-464-1018`;

  // ── Florida Summer Bridge personalization paragraph ──────────────────────
  const summerBridgePersonalizationLine = alreadyEC
    ? `Since your teachers are already familiar with EC's format, Summer Bridge is a natural extension — and we can work with you on kit timing to align with your program start date.`
    : hasFedFunding
    ? `EC supports Title I and Head Start compliance reporting, which can simplify documentation for any federally funded portions of your summer program.`
    : `Many Florida districts are using Summer Bridge as a lower-stakes entry point to pilot EC — with an eye toward full-year PreK adoption in the fall once they see the outcomes.`;

  const templates = {
    initial: `Subject: Supporting VPK → Kindergarten Readiness at ${district.district}

${greeting}

${hook}

${summerLine}

I'd be happy to share a quick overview or send sample materials — just reply here or use the link below to schedule a quick connect.

Schedule time with me: https://calendly.com/christie-cooley-brightwheel

${signature}`,

    followup1: `Subject: Following up — Kindergarten readiness support for ${district.county} County

${greeting}

Just following up on my note from last week. I know things are busy, so I'll keep this brief.

brightwheel's Experience Preschool is already in use across 50+ Florida school districts to support VPK students transitioning into Kindergarten. Directors consistently tell us two things: the pre-packaged daily lessons cut their prep time significantly, and families love the built-in progress updates.

${hasSummer ? `Given your summer program coming up, I'd love to get sample materials in your hands before the session starts.` : hasGrant ? `With the funding your district has secured, I'd love to help make sure it's going toward a curriculum that moves the needle on readiness outcomes.` : `If summer readiness or transition programming is on your radar, I'd love to get sample materials in front of your team.`}

Happy to send over a case study from a district similar to ${district.district}, or schedule a quick overview — whatever is most useful.

${signature}`,

    followup2: `Subject: One last note — ${district.county} County PreK + brightwheel

${greeting}

Last nudge, I promise.

${hook}

${hasSummer ? `With your summer program coming up, the timing feels right. I can have sample materials to you in 24 hours.` : `If this is something worth exploring for an upcoming program cycle, I can have sample materials to you in 24 hours.`}

No pressure — just here when the timing is right.

${signature}`,

    linkedin: `Hi there, I'm Christie at brightwheel — I work with Florida school districts on VPK-to-Kindergarten transition programming. I'd love to connect and share how brightwheel's Experience Preschool is helping districts like ${district.district} support readiness scores${hasSummer ? " and summer bridge programs" : ""}. Happy to connect!`,

    summerBridge: `Subject: EC for ${district.district}'s Summer Bridge Program — Ready to Ship

${greeting}

Florida's new Summer Bridge Program is now in effect, and districts are on the clock. Summer programs move fast — shorter timelines, leaner budgets, and less runway to get teachers ready. That's why I wanted to reach out now, while there's still time to lock in a solution for this summer.

Experience Curriculum (EC), offered in partnership with brightwheel, is a play-based, research-backed early childhood curriculum that ships everything teachers need in a ready-to-use monthly kit. One box for a 4-week program, two for an 8-week program — no procurement complexity, no supply coordination, no prep burden on your team.

Here's why EC is a strong fit for Summer Bridge specifically:

• Aligned to Florida's requirements. EC is aligned to the Florida Early Learning and Developmental Standards: 4 Years Old to Kindergarten, with emergent literacy instruction built into every lesson, directly meeting Rule 6A-6.0530 requirements.

• Ready for at-risk VPK students. EC's structured lesson guides and low prep burden make it practical even with smaller, mixed-ability cohorts like the below-10th-percentile students Summer Bridge serves.

• Built-in progress tracking. Student observations and portfolios are integrated through the brightwheel app, making it straightforward to document attendance, outcomes, and progress for your October 1 annual report to the Department.

• Fast to implement. New or substitute teachers can run EC without deep onboarding — important when summer staffing is less predictable.

${summerBridgePersonalizationLine}

I'd be happy to share a quick overview or send sample materials. Use the link below to schedule a quick connect.

Schedule time with me: https://calendly.com/christie-cooley-brightwheel

${signature}`,
  };

  return templates[template] || "";
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function BrightwheelDashboard() {
  const [districts, setDistricts] = useState(() =>
    INITIAL_DISTRICTS.map((d) => ({ ...d, priority: calculatePriorityScore(d) })).sort(
      (a, b) => b.priority - a.priority
    )
  );

  const [activeTab, setActiveTab] = useState("prospects");
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterCurriculum, setFilterCurriculum] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [modalTab, setModalTab] = useState("overview");
  const [approvalQueue, setApprovalQueue] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [newActivity, setNewActivity] = useState({ type: "email", date: new Date().toISOString().split("T")[0], notes: "" });
  const [notification, setNotification] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState("initial");
  const [emailPreview, setEmailPreview] = useState("");
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showSummerBridge, setShowSummerBridge] = useState(false);

  // ── BULK SELECTION ──
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkTemplate, setBulkTemplate] = useState("initial");

  const toggleSelect = (id) =>
    setSelectedIds((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((d) => selectedIds.has(d.id));
  const someVisibleSelected = filtered.some((d) => selectedIds.has(d.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => { const s = new Set(prev); filtered.forEach((d) => s.delete(d.id)); return s; });
    } else {
      setSelectedIds((prev) => { const s = new Set(prev); filtered.forEach((d) => s.add(d.id)); return s; });
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkQueue = (template) => {
    const toQueue = districts.filter((d) => selectedIds.has(d.id));
    toQueue.forEach((d) => queueEmail(d, template));
    showNotif(`${toQueue.length} email${toQueue.length !== 1 ? "s" : ""} queued ✓`);
    clearSelection();
  };

  const showNotif = (msg, color = "green") => {
    setNotification({ msg, color });
    setTimeout(() => setNotification(null), 3500);
  };

  // ── FILTERED DISTRICTS ──
  const filtered = useMemo(() => {
    return districts.filter((d) => {
      const matchSearch =
        d.district.toLowerCase().includes(search.toLowerCase()) ||
        d.director.toLowerCase().includes(search.toLowerCase()) ||
        d.county.toLowerCase().includes(search.toLowerCase());
      const matchPriority =
        filterPriority === "all" ||
        (filterPriority === "hot" && d.priority >= 75) ||
        (filterPriority === "warm" && d.priority >= 55 && d.priority < 75) ||
        (filterPriority === "cool" && d.priority >= 35 && d.priority < 55) ||
        (filterPriority === "cold" && d.priority < 35);
      const matchCurriculum =
        filterCurriculum === "all" || d.curriculumVendor === filterCurriculum;
      const matchStatus = filterStatus === "all" || d.status === filterStatus;
      return matchSearch && matchPriority && matchCurriculum && matchStatus;
    });
  }, [districts, search, filterPriority, filterCurriculum, filterStatus]);

  // ── STATS ──
  const stats = useMemo(() => ({
    total: districts.length,
    hot: districts.filter((d) => d.priority >= 75).length,
    warm: districts.filter((d) => d.priority >= 55 && d.priority < 75).length,
    contacted: districts.filter((d) => d.status !== "not contacted").length,
    queue: approvalQueue.length,
  }), [districts, approvalQueue]);

  const updateDistrict = (id, updates) => {
    setDistricts((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
    if (selectedDistrict?.id === id) setSelectedDistrict((prev) => ({ ...prev, ...updates }));
  };

  const addActivity = (district) => {
    if (!newActivity.notes) return;
    const act = { ...newActivity, id: Date.now(), district: district.district, directorName: district.director };
    const updatedActivities = [...(district.activities || []), act];
    updateDistrict(district.id, { activities: updatedActivities, status: newActivity.type === "meeting" ? "meeting scheduled" : district.status });
    setActivityLog((prev) => [act, ...prev]);
    setNewActivity({ type: "email", date: new Date().toISOString().split("T")[0], notes: "" });
    showNotif("Activity logged ✓");
  };

  const queueEmail = (district, template) => {
    const body = generateEmail(district, template);
    const item = {
      id: Date.now(),
      district: district.district,
      districtId: district.id,
      to: district.email,
      directorName: district.director,
      template,
      body,
      status: "pending",
      createdAt: new Date().toLocaleString(),
    };
    setApprovalQueue((prev) => [item, prev.find((x) => x.districtId === district.id && x.template === template) ? null : item].filter(Boolean));
    setApprovalQueue((prev) => {
      const exists = prev.find((x) => x.districtId === district.id && x.template === template);
      if (exists) return prev;
      return [item, ...prev];
    });
    updateDistrict(district.id, { status: "reached out" });
    showNotif(`📧 Email queued for Slack approval — ${district.director}`);
  };

  const approveEmail = (queueItem) => {
    setApprovalQueue((prev) => prev.filter((x) => x.id !== queueItem.id));
    showNotif(`✅ Approved & sent to Gmail drafts — ${queueItem.directorName}`);
  };

  const rejectEmail = (id) => {
    setApprovalQueue((prev) => prev.filter((x) => x.id !== id));
    showNotif("Email removed from queue.", "red");
  };

  const CURRICULUM_VENDORS = [...new Set(INITIAL_DISTRICTS.map((d) => d.curriculumVendor))];
  const STATUSES = ["not contacted", "reached out", "responded", "meeting scheduled", "proposal sent", "closed won", "closed lost"];

  const statusColor = (s) => {
    if (s === "closed won") return "text-green-600 font-semibold";
    if (s === "closed lost") return "text-red-500";
    if (s === "meeting scheduled") return "text-purple-600 font-semibold";
    if (s === "proposal sent") return "text-blue-600";
    if (s === "responded") return "text-teal-600";
    if (s === "reached out") return "text-orange-600";
    return "text-gray-400";
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-sm text-gray-800">
      {/* NOTIFICATION */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white font-medium transition-all ${notification.color === "red" ? "bg-red-500" : "bg-green-600"}`}>
          {notification.msg}
        </div>
      )}

      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">bw</div>
          <div>
            <h1 className="text-base font-bold text-gray-900">brightwheel · Florida PreK Sales Intelligence</h1>
            <p className="text-xs text-gray-400">Early Childhood Director Outreach — All 67 School Districts</p>
          </div>
        </div>
        <div className="flex gap-4 text-center">
          {[
            { label: "Total Districts", val: stats.total, color: "text-gray-700" },
            { label: "🔥 Hot Leads", val: stats.hot, color: "text-red-600" },
            { label: "🌡️ Warm Leads", val: stats.warm, color: "text-orange-500" },
            { label: "Contacted", val: stats.contacted, color: "text-indigo-600" },
            { label: "Pending Approval", val: stats.queue, color: "text-purple-600" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className={`text-xl font-bold ${s.color}`}>{s.val}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* TABS */}
      <div className="bg-white border-b border-gray-200 px-6 flex gap-1">
        {[
          { id: "prospects", label: "📋 Prospects" },
          { id: "outreach", label: "📤 Outreach Planner" },
          { id: "templates", label: "✉️ Email Templates" },
          { id: "activity", label: "📞 Activity Log" },
          { id: "approval", label: `✅ Approval Queue ${stats.queue > 0 ? `(${stats.queue})` : ""}` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors ${activeTab === t.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-6 py-4">
        {/* ── PROSPECTS TAB ── */}
        {activeTab === "prospects" && (
          <div>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4 items-center">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 Search district, director, county..."
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              {[
                { label: "Priority", val: filterPriority, setter: setFilterPriority, opts: [["all","All Priorities"],["hot","🔥 Hot"],["warm","🌡️ Warm"],["cool","💧 Cool"],["cold","❄️ Cold"]] },
                { label: "Curriculum", val: filterCurriculum, setter: setFilterCurriculum, opts: [["all","All Curricula"], ...CURRICULUM_VENDORS.map(v => [v, v])] },
                { label: "Status", val: filterStatus, setter: setFilterStatus, opts: [["all","All Statuses"], ...STATUSES.map(s => [s, s])] },
              ].map((f) => (
                <select
                  key={f.label}
                  value={f.val}
                  onChange={(e) => f.setter(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ))}
              <span className="text-xs text-gray-400 ml-2">{filtered.length} results</span>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wide">
                  <tr>
                    <th className="px-3 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        ref={(el) => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected; }}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-indigo-600 cursor-pointer"
                        title={allVisibleSelected ? "Deselect all" : "Select all visible"}
                      />
                    </th>
                    {["Priority", "District", "Director", "Curriculum", "Adopted", "Age", "Enrollment", "Signals", "Status", "Actions"].map((h) => (
                      <th key={h} className="px-3 py-3 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d, i) => {
                    const p = getPriorityLabel(d.priority);
                    const age = 2026 - d.curriculumAdoptionYear;
                    return (
                      <tr key={d.id} className={`border-t border-gray-100 hover:bg-indigo-50 transition-colors ${selectedIds.has(d.id) ? "bg-indigo-50 border-l-2 border-l-indigo-400" : i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                        <td className="px-3 py-2.5 w-8">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(d.id)}
                            onChange={() => toggleSelect(d.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-gray-300 text-indigo-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col gap-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium w-fit ${p.color}`}>{p.label}</span>
                            <span className="text-gray-400 text-xs">{d.priority}/100</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-gray-900">{d.county} County</div>
                          <div className="text-gray-400 text-xs truncate max-w-32">{d.district}</div>
                          {d.lastUpdated && <div className="text-green-600 text-xs mt-0.5">🔄 {d.lastUpdated}</div>}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium">{d.director}</div>
                          <div className="text-gray-400 truncate max-w-36">{d.email}</div>
                          <div className="text-gray-400">{d.phone}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs">{d.curriculum}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">{d.curriculumAdoptionYear}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`font-bold ${age >= 6 ? "text-red-600" : age >= 4 ? "text-orange-500" : "text-gray-500"}`}>{age}y</span>
                        </td>
                        <td className="px-3 py-2.5 text-right">{d.enrollment.toLocaleString()}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col gap-1">
                            {d.buyingSignals.length > 0 && (
                              <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-xs">{d.buyingSignals.length} signal{d.buyingSignals.length > 1 ? "s" : ""}</span>
                            )}
                            {d.boardNotes && d.boardNotes.length > 0 && (
                              <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-xs">📋 {d.boardNotes.length} board note{d.boardNotes.length > 1 ? "s" : ""}</span>
                            )}
                            {d.districtContext && d.districtContext.length > 0 && (
                              <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded text-xs">🔍 {d.districtContext.length} intel</span>
                            )}
                            {d.buyingSignals.length === 0 && (!d.boardNotes || d.boardNotes.length === 0) && (!d.districtContext || d.districtContext.length === 0) && <span className="text-gray-300">—</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            value={d.status}
                            onChange={(e) => updateDistrict(d.id, { status: e.target.value })}
                            className={`text-xs border-0 bg-transparent focus:outline-none cursor-pointer ${statusColor(d.status)}`}
                          >
                            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1">
                            <button
                              onClick={() => { setSelectedDistrict(d); setModalTab("overview"); }}
                              className="bg-indigo-600 text-white px-2 py-1 rounded text-xs hover:bg-indigo-700"
                            >
                              View
                            </button>
                            <button
                              onClick={() => queueEmail(d, "initial")}
                              className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
                            >
                              Email
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-12 text-gray-400">No districts match your filters.</div>
              )}
            </div>

            {/* ── BULK ACTION BAR ── */}
            {selectedIds.size > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl px-4">
                <div className="bg-gray-900 text-white rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-4 flex-wrap">
                  {/* Count + clear */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="bg-indigo-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">{selectedIds.size}</span>
                    <span className="text-sm font-medium">{selectedIds.size === 1 ? "district" : "districts"} selected</span>
                    <button onClick={clearSelection} className="text-gray-400 hover:text-white text-xs ml-1 underline">Clear</button>
                  </div>

                  <div className="flex-1" />

                  {/* Standard queue buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400 mr-1">Queue for all:</span>
                    {[
                      { label: "Initial Email", key: "initial", color: "bg-indigo-600 hover:bg-indigo-500" },
                      { label: "Follow-up 1", key: "followup1", color: "bg-indigo-600 hover:bg-indigo-500" },
                      { label: "Follow-up 2", key: "followup2", color: "bg-indigo-600 hover:bg-indigo-500" },
                    ].map((t) => (
                      <button
                        key={t.key}
                        onClick={() => bulkQueue(t.key)}
                        className={`text-xs text-white px-3 py-1.5 rounded-lg font-medium transition-colors ${t.color}`}
                      >{t.label}</button>
                    ))}

                    {/* FL Summer Bridge — primary CTA */}
                    <button
                      onClick={() => bulkQueue("summerBridge")}
                      className="text-xs bg-green-500 hover:bg-green-400 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors border border-green-400"
                    >
                      🌴 FL Summer Bridge
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── OUTREACH PLANNER TAB ── */}
        {activeTab === "outreach" && (
          <div>
            <div className="mb-4">
              <h2 className="text-base font-bold text-gray-900">Outreach Planner</h2>
              <p className="text-xs text-gray-500 mt-1">Recommended 4-touch outreach sequence per district. Priority-sorted.</p>
            </div>
            <div className="grid gap-4">
              {districts.filter((d) => d.priority >= 55).slice(0, 20).map((d) => {
                const p = getPriorityLabel(d.priority);
                const age = 2026 - d.curriculumAdoptionYear;
                const touches = [
                  { label: "Email #1 — Initial Outreach", template: "initial", done: d.activities?.some((a) => a.type === "email") },
                  { label: "LinkedIn Connect + Note", template: "linkedin", done: false },
                  { label: "Email #2 — Follow Up", template: "followup1", done: false },
                  { label: "Email #3 — Final Touch", template: "followup2", done: false },
                ];
                return (
                  <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.color}`}>{p.label}</span>
                          <span className="font-semibold text-gray-900">{d.district}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{d.director} · {d.email} · {d.phone}</div>
                        <div className="text-xs text-gray-400 mt-0.5">Current: <span className="text-indigo-600">{d.curriculum}</span> (adopted {d.curriculumAdoptionYear} — <span className="font-semibold text-red-500">{age} yrs old</span>)</div>
                      </div>
                      <span className={`text-xs ${statusColor(d.status)}`}>{d.status}</span>
                    </div>
                    {d.buyingSignals.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {d.buyingSignals.map((s, i) => (
                          <span key={i} className="bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded text-xs">⚡ {s}</span>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-4 gap-2">
                      {touches.map((t, i) => (
                        <div key={i} className={`rounded-lg border p-2 ${t.done ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                          <div className="text-xs font-medium text-gray-700 mb-1">Step {i + 1}</div>
                          <div className="text-xs text-gray-500 mb-2">{t.label}</div>
                          {t.template === "linkedin" ? (
                            <button
                              onClick={() => { setSelectedDistrict(d); setEmailPreview(generateEmail(d, "linkedin")); setShowEmailPreview(true); }}
                              className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                            >
                              Copy Message
                            </button>
                          ) : (
                            <button
                              onClick={() => queueEmail(d, t.template)}
                              className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
                            >
                              Queue Email
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── EMAIL TEMPLATES TAB ── */}
        {activeTab === "templates" && (
          <div className="max-w-4xl">
            <div className="mb-4">
              <h2 className="text-base font-bold text-gray-900">Email Templates</h2>
              <p className="text-xs text-gray-500 mt-1">Preview and customize outreach templates. Select a district to auto-personalize.</p>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Select District</label>
                <select
                  onChange={(e) => setSelectedDistrict(districts.find((d) => d.id === parseInt(e.target.value)) || null)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                >
                  <option value="">— Choose a district —</option>
                  {districts.slice(0, 30).map((d) => <option key={d.id} value={d.id}>{d.county} — {d.director}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Template</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                >
                  <option value="initial">Email #1 — Initial Outreach</option>
                  <option value="followup1">Email #2 — First Follow Up</option>
                  <option value="followup2">Email #3 — Final Touch</option>
                  <option value="linkedin">LinkedIn Note</option>
                </select>
              </div>
            </div>
            {selectedDistrict && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-900">Preview — {selectedDistrict.director} at {selectedDistrict.county} County</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { navigator.clipboard?.writeText(generateEmail(selectedDistrict, selectedTemplate)); showNotif("Copied to clipboard ✓"); }}
                      className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                    >Copy</button>
                    <button
                      onClick={() => queueEmail(selectedDistrict, selectedTemplate)}
                      className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700"
                    >Queue for Slack Approval →</button>
                  </div>
                </div>
                <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-4 leading-relaxed font-sans">
                  {generateEmail(selectedDistrict, selectedTemplate)}
                </pre>
              </div>
            )}
            {!selectedDistrict && (
              <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
                Select a district above to preview a personalized email template.
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVITY LOG TAB ── */}
        {activeTab === "activity" && (
          <div className="max-w-3xl">
            <div className="mb-4">
              <h2 className="text-base font-bold text-gray-900">Activity Log</h2>
              <p className="text-xs text-gray-500 mt-1">Track all calls, emails, and LinkedIn touchpoints. Open a district to log an activity.</p>
            </div>
            {activityLog.length === 0 ? (
              <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
                <p className="font-medium">No activities yet.</p>
                <p className="text-xs mt-1">Open a district from the Prospects tab and log a call, email, or note.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {activityLog.map((a) => (
                  <div key={a.id} className="border-b border-gray-100 last:border-b-0 px-4 py-3 flex gap-3 items-start">
                    <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                      a.type === "email" ? "bg-blue-100 text-blue-600" :
                      a.type === "call" ? "bg-green-100 text-green-600" :
                      a.type === "linkedin" ? "bg-indigo-100 text-indigo-600" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {a.type === "email" ? "✉️" : a.type === "call" ? "📞" : a.type === "linkedin" ? "🔗" : "📝"}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-800">{a.district}</span>
                        <span className="text-xs text-gray-400">{a.date}</span>
                      </div>
                      <span className="text-xs text-gray-400 capitalize">{a.type} · {a.directorName}</span>
                      <p className="text-xs text-gray-600 mt-1">{a.notes}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── APPROVAL QUEUE TAB ── */}
        {activeTab === "approval" && (
          <div className="max-w-3xl">
            <div className="mb-4">
              <h2 className="text-base font-bold text-gray-900">Slack Approval Queue</h2>
              <p className="text-xs text-gray-500 mt-1">
                Review and approve outreach emails before they go to Gmail drafts. Click <strong>Approve → Gmail</strong> to finalize.
              </p>
            </div>
            {approvalQueue.length === 0 ? (
              <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
                <p className="font-medium">Queue is empty.</p>
                <p className="text-xs mt-1">Queue emails from the Prospects or Outreach Planner tabs.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {approvalQueue.map((item) => (
                  <div key={item.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="bg-purple-50 border-b border-purple-100 px-4 py-3 flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-purple-800">{item.district}</span>
                        <span className="text-xs text-purple-500 ml-2">· {item.template.replace(/\d/, (m) => ` #${m}`)} · To: {item.to}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => approveEmail(item)}
                          className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-700 font-medium"
                        >
                          ✓ Approve → Gmail
                        </button>
                        <button
                          onClick={() => rejectEmail(item.id)}
                          className="bg-red-50 text-red-600 border border-red-200 text-xs px-3 py-1.5 rounded-lg hover:bg-red-100"
                        >
                          ✕ Remove
                        </button>
                      </div>
                    </div>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap p-4 leading-relaxed font-sans bg-white max-h-64 overflow-y-auto">
                      {item.body}
                    </pre>
                    <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                      Queued: {item.createdAt}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── DISTRICT DETAIL MODAL ── */}
      {selectedDistrict && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setSelectedDistrict(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-start rounded-t-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityLabel(selectedDistrict.priority).color}`}>
                    {getPriorityLabel(selectedDistrict.priority).label} · {selectedDistrict.priority}/100
                  </span>
                  {selectedDistrict.newLeadership && <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">🆕 New Leadership</span>}
                </div>
                <h2 className="text-lg font-bold text-gray-900 mt-1">{selectedDistrict.district}</h2>
                {selectedDistrict.lastUpdated && (
                  <span className="inline-block mt-1 text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                    🔄 Auto-updated {selectedDistrict.lastUpdated}
                  </span>
                )}
                <p className="text-sm text-gray-500">{selectedDistrict.address}</p>
              </div>
              <button onClick={() => setSelectedDistrict(null)} className="text-gray-400 hover:text-gray-700 text-xl font-light mt-1">✕</button>
            </div>

            {/* Modal Tabs */}
            <div className="border-b border-gray-200 px-6 flex gap-1">
              {["overview", "buying signals", "board notes", "district intel", "outreach", "log activity"].map((t) => (
                <button
                  key={t}
                  onClick={() => setModalTab(t)}
                  className={`px-4 py-2.5 text-xs font-medium border-b-2 capitalize transition-colors ${modalTab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-400 hover:text-gray-700"}`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="p-6">
              {modalTab === "overview" && (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Director Contact</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-gray-500">Name:</span> <span className="font-medium">{selectedDistrict.director}</span></div>
                      <div><span className="text-gray-500">Title:</span> {selectedDistrict.title}</div>
                      <div><span className="text-gray-500">Email:</span> <a href={`mailto:${selectedDistrict.email}`} className="text-indigo-600 hover:underline">{selectedDistrict.email}</a></div>
                      <div><span className="text-gray-500">Phone:</span> {selectedDistrict.phone}</div>
                      <div><span className="text-gray-500">LinkedIn:</span> {selectedDistrict.linkedin ? <a href={`https://${selectedDistrict.linkedin}`} target="_blank" className="text-blue-500 hover:underline">View Profile</a> : <span className="text-gray-300">Not found</span>}</div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Curriculum Profile</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-gray-500">Current:</span> <span className="font-medium text-indigo-700">{selectedDistrict.curriculum}</span></div>
                      <div><span className="text-gray-500">Vendor:</span> {selectedDistrict.curriculumVendor}</div>
                      <div><span className="text-gray-500">Adopted:</span> {selectedDistrict.curriculumAdoptionYear} <span className="text-red-500 font-medium">({2026 - selectedDistrict.curriculumAdoptionYear} years ago)</span></div>
                      <div><span className="text-gray-500">Enrollment:</span> {selectedDistrict.enrollment.toLocaleString()}</div>
                      <div><span className="text-gray-500">Status:</span>
                        <select
                          value={selectedDistrict.status}
                          onChange={(e) => updateDistrict(selectedDistrict.id, { status: e.target.value })}
                          className={`ml-2 text-xs border border-gray-200 rounded px-2 py-0.5 ${statusColor(selectedDistrict.status)}`}
                        >
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  {selectedDistrict.recentNews.length > 0 && (
                    <div className="col-span-2">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Recent News</h3>
                      {selectedDistrict.recentNews.map((n, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-gray-700 mb-1">
                          <span className="text-indigo-400 mt-0.5">📰</span>{n}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="col-span-2">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notes</h3>
                    <textarea
                      value={selectedDistrict.notes}
                      onChange={(e) => updateDistrict(selectedDistrict.id, { notes: e.target.value })}
                      placeholder="Add notes about this district..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 h-24 resize-none"
                    />
                  </div>
                  {selectedDistrict.activities?.length > 0 && (
                    <div className="col-span-2">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Contact History</h3>
                      {selectedDistrict.activities.map((a) => (
                        <div key={a.id} className="flex gap-2 items-start text-xs text-gray-600 border-l-2 border-indigo-200 pl-3 mb-2">
                          <span className="font-medium capitalize text-indigo-600">{a.type}</span>
                          <span className="text-gray-400">{a.date}</span>
                          <span>— {a.notes}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {modalTab === "buying signals" && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Why Now — Buying Signals</h3>
                  {selectedDistrict.buyingSignals.length === 0 ? (
                    <p className="text-gray-400 text-sm">No specific buying signals identified yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedDistrict.buyingSignals.map((s, i) => (
                        <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3">
                          <span className="text-amber-500 text-lg mt-0.5">⚡</span>
                          <div>
                            <p className="text-sm font-medium text-amber-800">{s}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-6 bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">Brightwheel Displacement Angle</h4>
                    <p className="text-sm text-indigo-700">
                      {selectedDistrict.curriculumAdoptionYear <= 2019
                        ? `${selectedDistrict.district} has been on ${selectedDistrict.curriculum} for ${2026 - selectedDistrict.curriculumAdoptionYear} years. This is prime displacement territory — pitch the full-platform angle: lesson plans + family engagement + billing + assessment, all in one app at a lower total cost.`
                        : `Position brightwheel as the modern alternative that grows with them. Emphasize the digital family engagement integration and the Florida VPK compliance alignment out of the box.`}
                    </p>
                  </div>
                </div>
              )}


              {modalTab === "board notes" && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Board Meeting Notes</h3>
                  <p className="text-xs text-gray-400 mb-4">Auto-populated weekly from public board meeting records and local news. Additive only — no entries are ever removed.</p>
                  {(!selectedDistrict.boardNotes || selectedDistrict.boardNotes.length === 0) ? (
                    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-400">
                      <p className="font-medium text-sm">No board notes yet.</p>
                      <p className="text-xs mt-1">The weekly GitHub Action will populate this when relevant board meetings are found.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[...(selectedDistrict.boardNotes || [])].sort((a,b) => b.date.localeCompare(a.date)).map((note, i) => (
                        <div key={i} className="bg-white border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-700">{note.date}</span>
                            {note.source && <a href={note.source} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline">Source ↗</a>}
                          </div>
                          <p className="text-sm text-gray-700">{note.summary}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {modalTab === "district intel" && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">District Intelligence</h3>
                  <p className="text-xs text-gray-400 mb-4">Auto-populated weekly from district websites, strategic plans, and funding sources. Used to personalize outreach emails.</p>
                  {(!selectedDistrict.districtContext || selectedDistrict.districtContext.length === 0) ? (
                    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-400">
                      <p className="font-medium text-sm">No context captured yet.</p>
                      <p className="text-xs mt-1">The weekly GitHub Action will populate this from district websites, strategic plans, and funding news.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[...(selectedDistrict.districtContext || [])].sort((a,b) => b.date.localeCompare(a.date)).map((ctx, i) => {
                        const typeColor = {
                          strategic: "bg-purple-50 border-purple-200 text-purple-700",
                          funding:   "bg-green-50 border-green-200 text-green-700",
                          website:   "bg-blue-50 border-blue-200 text-blue-700",
                        }[ctx.type] || "bg-gray-50 border-gray-200 text-gray-600";
                        const typeLabel = {
                          strategic: "📋 Strategic Plan",
                          funding:   "💰 Funding",
                          website:   "🌐 District Website",
                        }[ctx.type] || ctx.type;
                        return (
                          <div key={i} className="bg-white border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${typeColor}`}>{typeLabel}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">{ctx.date}</span>
                                {ctx.source && <a href={ctx.source} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline">Source ↗</a>}
                              </div>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed">{ctx.summary}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {selectedDistrict.districtContext && selectedDistrict.districtContext.length > 0 && (
                    <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <p className="text-xs font-semibold text-indigo-700 mb-1">📧 Email personalization preview</p>
                      <p className="text-xs text-indigo-600 leading-relaxed italic">
                        "{buildContextPersonalization(selectedDistrict).hook}"
                      </p>
                    </div>
                  )}
                </div>
              )}

              {modalTab === "outreach" && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Outreach Actions</h3>

                  {/* Standard sequence */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {[
                      { label: "Email #1 — Initial", key: "initial" },
                      { label: "Email #2 — Follow Up", key: "followup1" },
                      { label: "Email #3 — Final Touch", key: "followup2" },
                      { label: "LinkedIn Note", key: "linkedin" },
                    ].map((t) => (
                      <div key={t.key} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-xs font-medium text-gray-700 mb-2">{t.label}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setEmailPreview(generateEmail(selectedDistrict, t.key)); setShowEmailPreview(true); }}
                            className="text-xs border border-gray-200 bg-white px-2 py-1 rounded hover:bg-gray-50"
                          >Preview</button>
                          <button
                            onClick={() => { queueEmail(selectedDistrict, t.key); }}
                            className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
                          >Queue →</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Florida Summer Bridge toggle */}
                  <div className="border-t border-dashed border-gray-200 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">🌴 FL Summer Bridge</span>
                        <span className="text-xs text-gray-400">Florida districts only</span>
                      </div>
                      <button
                        onClick={() => setShowSummerBridge((v) => !v)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showSummerBridge ? "bg-green-500" : "bg-gray-200"}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${showSummerBridge ? "translate-x-4" : "translate-x-1"}`} />
                      </button>
                    </div>

                    {showSummerBridge && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-start gap-2 mb-3">
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-green-800 mb-0.5">FL Summer Bridge — Initial Outreach</p>
                            <p className="text-xs text-green-600 leading-relaxed">
                              Highlights Florida's Summer Bridge mandate, EC's alignment to Rule 6A-6.0530, and compliance reporting.
                              Auto-personalizes based on whether this district already uses EC and whether federal funding is on record.
                            </p>
                          </div>
                        </div>
                        {/* Auto-personalization indicator */}
                        <div className="bg-white border border-green-200 rounded p-2 mb-3 text-xs text-green-700">
                          <span className="font-semibold">Personalization applied: </span>
                          {districtAlreadyUsesEC(selectedDistrict)
                            ? "✅ Existing EC user — messaging adapted to Summer Bridge extension"
                            : districtHasFederalFunding(selectedDistrict)
                            ? "💰 Federal funding on record — messaging adapted to Title I / Head Start reporting"
                            : "🆕 New EC prospect — messaging adapted to Summer Bridge as a pilot entry point"}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setEmailPreview(generateEmail(selectedDistrict, "summerBridge")); setShowEmailPreview(true); }}
                            className="text-xs border border-green-300 bg-white text-green-700 px-2 py-1 rounded hover:bg-green-50"
                          >Preview</button>
                          <button
                            onClick={() => { queueEmail(selectedDistrict, "summerBridge"); }}
                            className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                          >Queue →</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {modalTab === "log activity" && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Log New Activity</h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Activity Type</label>
                      <select
                        value={newActivity.type}
                        onChange={(e) => setNewActivity((p) => ({ ...p, type: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                      >
                        <option value="email">✉️ Email Sent</option>
                        <option value="call">📞 Phone Call</option>
                        <option value="linkedin">🔗 LinkedIn</option>
                        <option value="meeting">📅 Meeting</option>
                        <option value="note">📝 Note</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Date</label>
                      <input
                        type="date"
                        value={newActivity.date}
                        onChange={(e) => setNewActivity((p) => ({ ...p, date: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                      />
                    </div>
                  </div>
                  <textarea
                    value={newActivity.notes}
                    onChange={(e) => setNewActivity((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Notes about this contact (outcome, next steps, etc.)..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 mb-3"
                  />
                  <button
                    onClick={() => addActivity(selectedDistrict)}
                    disabled={!newActivity.notes}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-40"
                  >
                    Log Activity
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Preview Modal */}
      {showEmailPreview && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowEmailPreview(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Email Preview</h3>
              <div className="flex gap-2">
                <button onClick={() => { navigator.clipboard?.writeText(emailPreview); showNotif("Copied!"); }} className="text-xs border border-gray-200 px-3 py-1.5 rounded hover:bg-gray-50">Copy</button>
                <button onClick={() => setShowEmailPreview(false)} className="text-gray-400 hover:text-gray-700 text-xl font-light">✕</button>
              </div>
            </div>
            <pre className="text-sm text-gray-700 whitespace-pre-wrap p-6 font-sans leading-relaxed">{emailPreview}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
