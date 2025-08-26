import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion as fm } from "framer-motion";
import {
  Plus, CalendarDays, Users, ChevronDown, ChevronUp,
  ClipboardList, X, UserPlus, Trash, FileText, FolderPlus, Search
} from "lucide-react";

/**********************
 * Runtime Smoke Tests *
 **********************/
(function runDevTests() {
  try {
    console.assert(typeof fm !== "undefined", "framer-motion alias 'fm' should be defined");
    const base = new Date("2025-01-01T00:00:00Z");
    const d2 = addDays(base, 2);
    console.assert(ymd(d2) === "2025-01-03", "addDays should add calendar days");
    const a = new Date("2025-01-01T00:00:00");
    const b = new Date("2025-01-10T00:00:00");
    console.assert(daysBetween(a, b) === 9, "daysBetween should be 9");
    console.assert(daysBetween(b, a) === -9, "daysBetween antisymmetric");
    console.assert(ymd("not-a-date") === "", "ymd invalid -> empty");
    const t = { id: "t1", start: "2025-01-01", end: "2025-01-02", dependsOn: [] };
    ["id", "start", "end"].forEach((k) => console.assert(k in t, `task missing ${k}`));
  } catch (_) {}
})();

/***************
 * Local Store *
 ***************/
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (e) {
      return initialValue;
    }
  });
  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }, [key, value]);
  return [value, setValue];
}

/****************
 * Date Helpers *
 ****************/
function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function formatMD(d) { return new Date(d).toLocaleDateString(undefined,{month:"short",day:"numeric"}); }
function ymd(d) { const dt = new Date(d); if (isNaN(dt.getTime())) return ""; return dt.toISOString().slice(0,10); }
function daysBetween(a,b){ const A=startOfDay(a),B=startOfDay(b); return Math.round((B-A)/(1000*60*60*24)); }

/********
 * Seed *
 ********/
const defaultUser = { id:"u_demo", name:"Demo Admin", email:"admin@example.com", role:"admin" };
const seedProject = {
  id:"P-1001", name:"Sample Build – East Campus",
  address:"1234 Stonebridge Way, Knoxville, TN",
  client:"Stonebridge Dev Co.", owner:"Demo Admin",
  status:"Active", budget:1250000, description:"Site prep + foundations + shell",
  start: ymd(addDays(new Date(), -7)), end: ymd(addDays(new Date(), 23)),
  tags:["Phase 1","Concrete","Scheduling"]
};
const seedTasks = [
  { id:"t1", projectId:seedProject.id, name:"Mobilize", start:ymd(addDays(new Date(),-6)), end:ymd(addDays(new Date(),-3)), assignee:"Field Ops", percent:100, dependsOn:[] },
  { id:"t2", projectId:seedProject.id, name:"Site Prep", start:ymd(addDays(new Date(),-2)), end:ymd(addDays(new Date(),5)), assignee:"Grading", percent:60, dependsOn:["t1"] },
  { id:"t3", projectId:seedProject.id, name:"Footings", start:ymd(addDays(new Date(),3)), end:ymd(addDays(new Date(),12)), assignee:"Concrete", percent:0, dependsOn:["t2"] },
  { id:"t4", projectId:seedProject.id, name:"Underground MEP", start:ymd(addDays(new Date(),8)), end:ymd(addDays(new Date(),18)), assignee:"MEP", percent:0, dependsOn:["t3"] },
];

/********************
 * Reusable Modals  *
 ********************/
function DocModal({ open, onClose, onSave, date, type, defaultValues }) {
  const [values, setValues] = useState(defaultValues || {});
  const [imagePreviews, setImagePreviews] = useState([]);
  useEffect(() => {
    setValues(defaultValues || {});
    setImagePreviews(defaultValues?.images || []);
  }, [defaultValues, type]);
  if (!open) return null;

  const fieldDefs = {
    "Change Order": [
      { key:"title", label:"Title", required:true },
      { key:"number", label:"CO #", required:true },
      { key:"scope", label:"Scope of Work", textarea:true, required:true },
      { key:"amount", label:"Amount ($)", type:"number" },
      { key:"requestedBy", label:"Requested By" },
      { key:"notes", label:"Notes", textarea:true },
    ],
    "Submittal": [
      { key:"title", label:"Title", required:true },
      { key:"spec", label:"Spec Section", required:true },
      { key:"package", label:"Package #" },
      { key:"due", label:"Due Date", type:"date" },
      { key:"notes", label:"Notes", textarea:true },
    ],
    "RFI": [
      { key:"title", label:"Question Title", required:true },
      { key:"rfi", label:"RFI #", required:true },
      { key:"question", label:"Question", textarea:true, required:true },
      { key:"neededBy", label:"Needed By", type:"date" },
    ],
    "Other": [
      { key:"title", label:"Title", required:true },
      { key:"description", label:"Description", textarea:true },
    ],
  };
  const fields = fieldDefs[type] || fieldDefs["Other"];

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    const reads = await Promise.all(files.map(file => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name:file.name, dataUrl:reader.result });
      reader.readAsDataURL(file);
    })));
    const next = [...imagePreviews, ...reads];
    setImagePreviews(next);
    setValues(v => ({ ...v, images: next }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (fields.some(f => f.required && !values[f.key])) return alert("Please fill required fields");
    onSave({ ...values, title: values.title || `${type} – ${formatMD(date)}`, _type: type, images: imagePreviews });
  };

  return (
    <fm.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-50">
      <fm.div initial={{scale:0.98, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.98, opacity:0}} className="w-full max-w-xl rounded-3xl bg-white/90 backdrop-blur shadow-2xl border border-gray-200">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="font-semibold flex items-center gap-2">
            <FolderPlus className="w-4 h-4" /> New {type}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-sm">
          {fields.map((f) => (
            <label key={f.key} className="block">
              <div className="text-xs text-gray-600 mb-1">
                {f.label}{f.required ? " *" : ""}
              </div>
              {f.textarea ? (
                <textarea className="border rounded-xl p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  value={values[f.key] || ""} onChange={(e)=>setValues(v=>({...v,[f.key]:e.target.value}))} />
              ) : (
                <input type={f.type || "text"} className="border rounded-xl p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  value={values[f.key] || ""} onChange={(e)=>setValues(v=>({...v,[f.key]:e.target.value}))} />
              )}
            </label>
          ))}
          <div>
            <div className="text-xs text-gray-600 mb-1">Images (optional)</div>
            <input type="file" accept="image/*" multiple onChange={handleFiles} />
            {imagePreviews?.length ? (
              <div className="mt-2 grid grid-cols-5 gap-2">
                {imagePreviews.map((img, idx) => (
                  <div key={idx} className="border rounded-xl overflow-hidden">
                    <img src={img.dataUrl} alt={img.name} className="w-full h-16 object-cover" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-xl border hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-600/90 shadow">Save</button>
          </div>
        </form>
      </fm.div>
    </fm.div>
  );
}

function DocViewModal({ open, onClose, doc }) {
  if (!open || !doc) return null;
  const keysToShow = Object.keys(doc).filter(k => !["id","createdAt","createdBy","_type","images"].includes(k));
  return (
    <fm.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
      <fm.div initial={{scale:0.98, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.98, opacity:0}} className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl bg-white/90 backdrop-blur shadow-2xl border">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4" /> {doc.title}
            </div>
            <div className="text-xs text-gray-600">{doc._type} • {new Date(doc.createdAt).toLocaleString()} • by {doc.createdBy}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3 text-sm">
          {keysToShow.map(k => (
            <div key={k} className="border rounded-xl p-3 bg-white/70">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">{k}</div>
              <div className="mt-1 whitespace-pre-wrap">{String(doc[k])}</div>
            </div>
          ))}
          {doc.images?.length ? (
            <div>
              <div className="text-xs text-gray-600 mb-1">Images</div>
              <div className="grid grid-cols-2 gap-3">
                {doc.images.map((img, i) => (
                  <img key={i} src={img.dataUrl || img} alt={img.name || `image-${i}`}
                    className="w-full max-h-72 object-contain rounded-2xl border bg-white" />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </fm.div>
    </fm.div>
  );
}

/****************
 * UI Components *
 ****************/
function LeftPanel({ projects, onCreateProject, selectedProjectId, setSelectedProjectId, onAddTask, taskCount }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name:"", id:"", address:"", client:"", owner: defaultUser.name,
    status:"Planned", budget:"", description:"",
    start: ymd(new Date()), end: ymd(addDays(new Date(), 30)), tags:"",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const proj = {
      ...form,
      budget: form.budget ? Number(form.budget) : undefined,
      tags: form.tags ? form.tags.split(",").map(s=>s.trim()).filter(Boolean) : [],
    };
    if (!proj.id || !proj.name) return alert("Project Name and Project ID are required");
    onCreateProject(proj);
    setOpen(false);
    setForm({ name:"", id:"", address:"", client:"", owner: defaultUser.name, status:"Planned", budget:"", description:"", start: ymd(new Date()), end: ymd(addDays(new Date(),30)), tags:"" });
  };

  return (
    <div className="h-full w-full flex flex-col">
      <div className="p-3 border-b bg-white/80 backdrop-blur flex items-center justify-between">
        <div className="font-semibold text-lg flex items-center gap-2"><Users className="w-5 h-5" /> Projects</div>
        <button onClick={()=>setOpen(v=>!v)} className="px-2 py-1 rounded-xl border text-sm flex items-center gap-1 hover:bg-gray-50">
          <Plus className="w-4 h-4" /> New {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <div className="p-2 overflow-y-auto space-y-2">
        {projects.map((p) => (
          <button key={p.id} onClick={()=>setSelectedProjectId(p.id)}
            className={`w-full text-left p-3 rounded-2xl border hover:shadow ${selectedProjectId === p.id ? "border-blue-500 shadow" : "border-gray-200"}`}>
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-gray-600">ID: {p.id}</div>
            <div className="text-xs text-gray-600">{p.address}</div>
          </button>
        ))}
      </div>

      <div className="mt-auto border-t p-3 space-y-2 bg-white/80 backdrop-blur">
        <div className="flex items-center justify-between text-sm">
          <div className="font-medium">Gantt Tasks</div>
          <span className="text-xs text-gray-600">{taskCount ?? 0} total</span>
        </div>
        <button onClick={onAddTask} disabled={!selectedProjectId}
          className={`w-full px-3 py-2 rounded-xl border flex items-center justify-center gap-2 ${selectedProjectId ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-95" : "opacity-50 cursor-not-allowed"}`}>
          <Plus className="w-4 h-4" /> Add Task
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <fm.div initial={{height:0, opacity:0}} animate={{height:"auto", opacity:1}} exit={{height:0, opacity:0}} className="border-t p-3 bg-white/80 backdrop-blur">
            <div className="font-semibold mb-2">Create Project</div>
            <form onSubmit={handleSubmit} className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <input className="border rounded-xl px-2 py-1" placeholder="Project Name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
                <input className="border rounded-xl px-2 py-1" placeholder="Project ID" value={form.id} onChange={e=>setForm({...form, id:e.target.value})} />
                <input className="border rounded-xl px-2 py-1" placeholder="Client" value={form.client} onChange={e=>setForm({...form, client:e.target.value})} />
                <input className="border rounded-xl px-2 py-1" placeholder="Owner" value={form.owner} onChange={e=>setForm({...form, owner:e.target.value})} />
                <input className="border rounded-xl px-2 py-1" placeholder="Status" value={form.status} onChange={e=>setForm({...form, status:e.target.value})} />
                <input className="border rounded-xl px-2 py-1" placeholder="Budget (optional)" value={form.budget} onChange={e=>setForm({...form, budget:e.target.value})} />
              </div>
              <input className="border rounded-xl px-2 py-1 w-full" placeholder="Project Address" value={form.address} onChange={e=>setForm({...form, address:e.target.value})} />
              <textarea className="border rounded-xl px-2 py-1 w-full" placeholder="Description" value={form.description} onChange={e=>setForm({...form, description:e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">Start
                  <input type="date" className="border rounded-xl px-2 py-1 w-full" value={form.start} onChange={e=>setForm({...form, start:e.target.value})} />
                </label>
                <label className="text-xs">End
                  <input type="date" className="border rounded-xl px-2 py-1 w-full" value={form.end} onChange={e=>setForm({...form, end:e.target.value})} />
                </label>
              </div>
              <input className="border rounded-xl px-2 py-1 w-full" placeholder="Tags (comma separated)" value={form.tags} onChange={e=>setForm({...form, tags:e.target.value})} />
              <div className="flex items-center justify-end gap-2">
                <button type="button" className="px-3 py-1.5 rounded-xl border hover:bg-gray-50" onClick={()=>setOpen(false)}>Cancel</button>
                <button type="submit" className="px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-600/90 shadow">Create</button>
              </div>
            </form>
          </fm.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProjectHeader({ project }) {
  if (!project) return (
    <div className="p-3 border-b bg-white/70 backdrop-blur rounded-2xl mb-2">
      <div className="text-sm text-gray-600">Select or create a project to begin.</div>
    </div>
  );
  return (
    <div className="p-4 border-b bg-gradient-to-r from-blue-100 via-white to-purple-100 backdrop-blur rounded-3xl shadow mb-3">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <div className="text-xl font-semibold flex items-center gap-2">
            {project.name}
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{project.status}</span>
          </div>
          <div className="text-xs text-gray-600">ID: {project.id} • {project.address}</div>
          <div className="text-xs text-gray-600">Timeline: {project.start} → {project.end}</div>
        </div>
      </div>
    </div>
  );
}

function DayTile({ date, docs, onAddDoc }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [viewDoc, setViewDoc] = useState(null);
  const openModal = (t) => { setModalType(t); setPickerOpen(false); };
  const LIST_MAX_HEIGHT = 234;
  const extraCount = Math.max(0, (docs?.length || 0) - 3);

  return (
    <div className="relative min-w-[220px] max-w-[220px] w-[220px] border-r bg-white/70 rounded-2xl shadow-sm flex flex-col">
      <div className="p-2 flex items-center justify-between border-b sticky top-0 bg-white/80 rounded-t-2xl">
        <div className="text-sm font-semibold flex items-center gap-1"><CalendarDays className="w-4 h-4" /> {formatMD(date)}</div>
        <div className="relative">
          <button onClick={()=>setPickerOpen(v=>!v)} className="p-1.5 rounded-full hover:bg-gray-100" title="Add file"><Plus className="w-5 h-5" /></button>
          <AnimatePresence>
            {pickerOpen && (
              <fm.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} className="absolute right-0 mt-2 w-44 rounded-xl border bg-white shadow z-10">
                {["Change Order","Submittal","RFI","Other"].map((t)=>(
                  <button key={t} onClick={()=>openModal(t)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> {t}
                  </button>
                ))}
              </fm.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="p-2 space-y-2 overflow-y-auto" style={{ maxHeight: LIST_MAX_HEIGHT }}>
        {docs?.length ? (
          docs.map((d) => (
            <button key={d.id} onClick={()=>setViewDoc(d)} className="text-left w-full border rounded-2xl p-2 shadow-sm bg-white hover:bg-gray-50">
              <div className="text-xs text-gray-500">{d._type || d.type} • {new Date(d.createdAt).toLocaleTimeString()}</div>
              <div className="text-sm mt-1 font-medium flex items-center gap-2"><FileText className="w-4 h-4" /> {d.title}</div>
              {d.amount ? <div className="text-xs text-gray-600">Amount: ${Number(d.amount).toLocaleString()}</div> : null}
              {d.spec ? <div className="text-xs text-gray-600">Spec: {d.spec}</div> : null}
            </button>
          ))
        ) : (
          <div className="text-xs text-gray-500">No files yet.</div>
        )}
      </div>
      {extraCount > 0 && <div className="px-2 py-1 text-[11px] text-gray-600 border-t bg-white/70">+{extraCount} more • scroll to view</div>}

      <AnimatePresence>
        {modalType && (
          <DocModal open={!!modalType} onClose={()=>setModalType(null)} onSave={(payload)=>{ onAddDoc(payload); setModalType(null); }} date={date} type={modalType} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {viewDoc && <DocViewModal open={!!viewDoc} onClose={()=>setViewDoc(null)} doc={viewDoc} />}
      </AnimatePresence>
    </div>
  );
}

function CalendarStrip({ startDate, days, dataByDate, onAddDoc, scrollToDate }) {
  const containerRef = useRef(null);
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const onWheel = (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); el.scrollLeft += e.deltaY; } };
    el.addEventListener("wheel", onWheel, { passive:false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const el = containerRef.current; if (!el || !scrollToDate) return;
    const idx = Math.max(0, Math.min(days - 1, daysBetween(startDate, startOfDay(scrollToDate))));
    const approxTile = el.scrollWidth / days;
    el.scrollTo({ left: idx * approxTile - el.clientWidth/2 + approxTile/2, behavior: "smooth" });
  }, [scrollToDate, startDate, days]);

  const todayIdx = Math.max(0, Math.min(days - 1, daysBetween(startDate, startOfDay(new Date()))));

  return (
    <div ref={containerRef} className="w-full overflow-x-auto flex gap-2 p-2 border rounded-3xl bg-white/60 relative">
      <div className="absolute inset-0 pointer-events-none flex">
        {Array.from({ length: days }).map((_, i) => (
          <div key={i} className="min-w-[220px] max-w-[220px] w-[220px] border-r border-gray-200"></div>
        ))}
      </div>
      <div className="pointer-events-none absolute top-0 bottom-0" style={{ left: `calc(${todayIdx} * 222px + 1px)` }}>
        <div className="w-px h-full bg-blue-500/60" />
      </div>
      {Array.from({ length: days }).map((_, i) => {
        const d = addDays(startDate, i);
        const key = ymd(d);
        return <DayTile key={key} date={d} docs={dataByDate[key] || []} onAddDoc={(payload)=>onAddDoc(key, payload)} />;
      })}
    </div>
  );
}

/***********************
 * Lean Gantt Chart     *
 ***********************/
function Gantt({ project, tasks, rangeStart, rangeEnd, onEditTask }) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const days = Math.max(1, daysBetween(rangeStart, rangeEnd) + 1);
  const colWidth = 28;
  const gridWidth = days * colWidth;
  const ROW_H = 36;
  const BAR_H = 18;

  const toOffset = (dateStr) => daysBetween(rangeStart, new Date(dateStr)) * colWidth;
  const toWidth = (s, e) => (daysBetween(new Date(s), new Date(e)) + 1) * colWidth;

  return (
    <div className="mt-3 border rounded-lg overflow-hidden bg-white">
      <div className="p-2 bg-gray-50 border-b flex items-center gap-2">
        <ClipboardList className="w-5 h-5" />
        <div className="font-semibold">Gantt – {project?.name || "—"}</div>
      </div>

      <div className="relative overflow-x-auto">
        <div className="relative" style={{ width: gridWidth }}>
          {/* Grid columns */}
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${days}, ${colWidth}px)` }}>
            {Array.from({ length: days }).map((_, i) => (
              <div key={i} className="border-r border-gray-200" />
            ))}
          </div>

          {/* Task bars */}
          {safeTasks.map((t, i) => {
            const left = toOffset(t.start);
            const width = Math.max(colWidth, toWidth(t.start, t.end));
            const top = i * ROW_H + 8;
            return (
              <div
                key={t.id}
                className="absolute bg-blue-500 text-white text-xs rounded px-2 flex items-center shadow cursor-default"
                style={{ left, top, width, height: BAR_H }}
                title={`${t.name} • ${t.start} → ${t.end}`}
                onDoubleClick={() => onEditTask && onEditTask(t)}
              >
                {t.name}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/********
 * App   *
 ********/
export default function App() {
  const [user] = useLocalStorage("cv_user", defaultUser);
  const [projects, setProjects] = useLocalStorage("cv_projects", [seedProject]);
  const [docs, setDocs] = useLocalStorage("cv_docs", {});
  const [tasks, setTasks] = useLocalStorage("cv_tasks", seedTasks);
  const [selectedProjectId, setSelectedProjectId] = useLocalStorage("cv_selectedProject", seedProject.id);
  const [memberships, setMemberships] = useLocalStorage("cv_memberships", { [seedProject.id]: [{ email:"admin@example.com", role:"admin" }] });

  const project = useMemo(()=>projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  const memberCount = (memberships[selectedProjectId] || []).length;

  const today = startOfDay(new Date());
  const rangeStart = addDays(today, -7);
  const daysWindow = 30;
  const ganttRangeEnd = addDays(today, 23);

  const docsForProject = docs[selectedProjectId] || {};

  const addDoc = (dateKey, payload) => {
    const id = Math.random().toString(36).slice(2);
    const entry = { id, ...payload, createdBy: defaultUser.name, createdAt: new Date().toISOString() };
    setDocs(prev => ({
      ...prev,
      [selectedProjectId]: {
        ...(prev[selectedProjectId] || {}),
        [dateKey]: [...((prev[selectedProjectId]||{})[dateKey] || []), entry],
      },
    }));
  };

  const addProject = (proj) => {
    setProjects(prev => [{...proj}, ...prev]);
    setSelectedProjectId(proj.id);
    setMemberships(m => ({ ...m, [proj.id]: [{ email: defaultUser.email, role: defaultUser.role }] }));
  };

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const emailOk = /.+@.+\..+/.test(inviteEmail);

  const addMember = () => {
    if (!project || !emailOk) return;
    const list = memberships[project.id] || [];
    if (list.find(m => m.email.toLowerCase() === inviteEmail.toLowerCase())) return alert("Already invited");
    const next = { ...memberships, [project.id]: [...list, { email: inviteEmail, role: inviteRole }] };
    setMemberships(next);
    setInviteEmail("");
  };
  const removeMember = (email) => {
    if (!project) return;
    const list = (memberships[project.id] || []).filter(m => m.email !== email);
    setMemberships({ ...memberships, [project.id]: list });
  };

  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskForm, setTaskForm] = useState({ name:"", assignee:"", start: ymd(today), end: ymd(addDays(today, 5)), percent: 0, dependsOn: [] });

  const tasksForProject = (tasks || []).filter(t => t.projectId === project?.id);

  const openNewTask = () => { setEditingTaskId(null); setTaskForm({ name:"", assignee:"", start: ymd(today), end: ymd(addDays(today,5)), percent:0, dependsOn:[] }); setTaskFormOpen(true); };
  const openEditTask = (t) => { setEditingTaskId(t.id); setTaskForm({ name:t.name||"", assignee:t.assignee||"", start:t.start||ymd(today), end:t.end||ymd(addDays(today,5)), percent:t.percent||0, dependsOn:Array.isArray(t.dependsOn)?t.dependsOn:[] }); setTaskFormOpen(true); };

  const submitTask = (e) => {
    e.preventDefault();
    if (!project) return;
    const ensure = (t) => ({ ...t, projectId: project.id, id: t.id || Math.random().toString(36).slice(2), dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn : [] });
    if (editingTaskId) {
      setTasks(prev => prev.map(t => (t.id === editingTaskId ? ensure({ ...t, ...taskForm }) : t)));
    } else {
      setTasks(prev => [...prev, ensure({ ...taskForm })]);
    }
    setTaskFormOpen(false);
  };
  const deleteTask = () => {
    if (!editingTaskId) return;
    setTasks(prev => prev.filter(t => t.id !== editingTaskId));
    setTaskFormOpen(false);
  };

  const [calScrollTo, setCalScrollTo] = useState(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 text-gray-900">
      <div className="h-16 border-b bg-gradient-to-r from-blue-100 via-white to-purple-100 backdrop-blur flex items-center justify-between px-4 sticky top-0 z-20">
        <div className="flex items-center gap-4 font-semibold">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white grid place-items-center shadow">CV</div>
          <span className="tracking-tight">Clearview – Alpha</span>
          {project && (
            <div className="hidden lg:flex items-center gap-2 text-xs">
              <span className="px-2 py-1 rounded-full border">Client: {project.client || "—"}</span>
              <span className="px-2 py-1 rounded-full border">Owner: {project.owner || "—"}</span>
              {project.budget ? <span className="px-2 py-1 rounded-full border">Budget: ${project.budget.toLocaleString()}</span> : null}
              {project.tags?.length ? <span className="px-2 py-1 rounded-full border">Tags: {project.tags.join(", ")}</span> : null}
              <span className="px-2 py-1 rounded-full border">Members: {(memberships[project.id]||[]).length}</span>
              <button disabled={!defaultUser || defaultUser.role !== "admin"} onClick={()=>setInviteOpen(true)}
                className={`px-2 py-1 rounded-xl border flex items-center gap-1 ${defaultUser?.role === "admin" ? "hover:bg-gray-50" : "opacity-50 cursor-not-allowed"}`}>
                <UserPlus className="w-4 h-4" /> Invite
              </button>
            </div>
          )}
        </div>
        <div className="hidden md:flex items-center gap-2 text-sm">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-2.5 text-gray-400" />
            <input placeholder="Search…" className="pl-8 pr-2 py-1.5 rounded-xl border bg-white/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <span className="text-gray-500">Logged in as <b>{defaultUser.name}</b> ({defaultUser.role})</span>
        </div>
      </div>

      <div className="grid grid-cols-[320px_1fr] gap-4 p-4">
        <div className="rounded-3xl border bg-white shadow-sm overflow-hidden">
          <LeftPanel
            projects={projects}
            onCreateProject={addProject}
            selectedProjectId={selectedProjectId}
            setSelectedProjectId={setSelectedProjectId}
            onAddTask={openNewTask}
            taskCount={tasksForProject.length}
          />
        </div>

        <div className="rounded-3xl">
          <ProjectHeader project={project} />
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold flex items-center gap-2">
                <CalendarDays className="w-5 h-5" /> Day Tiles
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <button className="px-2 py-1.5 rounded-xl border bg-white hover:bg-gray-50" onClick={()=>setCalScrollTo(new Date())}>Today</button>
                <span>Scroll with mouse wheel ◀▶</span>
              </div>
            </div>
            <CalendarStrip startDate={rangeStart} days={daysWindow} dataByDate={docsForProject} onAddDoc={addDoc} scrollToDate={calScrollTo} />
          </div>

          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="px-2 py-1 rounded-full border bg-white">Range: {ymd(rangeStart)} → {ymd(ganttRangeEnd)}</span>
            </div>
            <button className="px-3 py-1.5 rounded-xl border bg-white hover:bg-gray-50" onClick={openNewTask}>
              <Plus className="w-4 h-4 inline mr-1" />New Task
            </button>
          </div>
          <Gantt project={project} tasks={tasksForProject} rangeStart={rangeStart} rangeEnd={ganttRangeEnd} onEditTask={openEditTask} />
        </div>
      </div>

      {/* Task modal */}
      <AnimatePresence>
        {taskFormOpen && (
          <fm.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/30 grid place-items-center p-4">
            <fm.div initial={{scale:0.98, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.98, opacity:0}} className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border">
              <div className="p-3 border-b flex items-center justify-between">
                <div className="font-semibold">{editingTaskId ? "Edit Task" : "Add Task"}</div>
                <button onClick={()=>setTaskFormOpen(false)} className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={submitTask} className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">Task Name
                    <input className="border rounded-xl px-2 py-1 w-full" value={taskForm.name} onChange={e=>setTaskForm({...taskForm, name:e.target.value})} required />
                  </label>
                  <label className="text-sm">Assignee
                    <input className="border rounded-xl px-2 py-1 w-full" value={taskForm.assignee} onChange={e=>setTaskForm({...taskForm, assignee:e.target.value})} />
                  </label>
                  <label className="text-sm">Start
                    <input type="date" className="border rounded-xl px-2 py-1 w-full" value={taskForm.start} onChange={e=>setTaskForm({...taskForm, start:e.target.value})} required />
                  </label>
                  <label className="text-sm">End
                    <input type="date" className="border rounded-xl px-2 py-1 w-full" value={taskForm.end} onChange={e=>setTaskForm({...taskForm, end:e.target.value})} required />
                  </label>
                </div>
                <label className="block text-sm">Percent Complete: {taskForm.percent}%
                  <input type="range" min={0} max={100} step={5} value={taskForm.percent} onChange={e=>setTaskForm({...taskForm, percent:Number(e.target.value)})} className="w-full" />
                </label>
                <div className="border rounded-xl p-3">
                  <div className="text-xs font-medium mb-2">Depends on</div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {tasksForProject.filter(t=>!editingTaskId || t.id !== editingTaskId).map(t => {
                      const checked = taskForm.dependsOn?.includes(t.id);
                      return (
                        <label key={t.id} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={!!checked} onChange={(e)=>{
                            const next = new Set(taskForm.dependsOn || []);
                            if (e.target.checked) next.add(t.id); else next.delete(t.id);
                            setTaskForm({...taskForm, dependsOn: Array.from(next)});
                          }} />
                          <span>{t.name}</span>
                        </label>
                      );
                    })}
                    {!tasksForProject.length && <div className="text-xs text-gray-500">No other tasks yet.</div>}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  {editingTaskId ? (
                    <button type="button" onClick={deleteTask} className="px-3 py-1.5 rounded-xl border flex items-center gap-1 hover:bg-gray-50 text-red-600">
                      <Trash className="w-4 h-4" /> Delete
                    </button>
                  ) : <span />}
                  <div className="flex gap-2">
                    <button type="button" className="px-3 py-1.5 rounded-xl border" onClick={()=>setTaskFormOpen(false)}>Cancel</button>
                    <button type="submit" className="px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-600/90 shadow">
                      {editingTaskId ? "Save Changes" : "Save Task"}
                    </button>
                  </div>
                </div>
              </form>
            </fm.div>
          </fm.div>
        )}
      </AnimatePresence>

      {/* Invite modal */}
      <AnimatePresence>
        {inviteOpen && (
          <fm.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/30 grid place-items-center p-4">
            <fm.div initial={{scale:0.98, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.98, opacity:0}} className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border">
              <div className="p-3 border-b flex items-center justify-between">
                <div className="font-semibold">Invite Users</div>
                <button onClick={()=>setInviteOpen(false)} className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4 space-y-3 text-sm">
                <div className="flex gap-2">
                  <input placeholder="user@company.com" className="border rounded-xl px-2 py-1 flex-1" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} />
                  <select className="border rounded-xl px-2 py-1" value={inviteRole} onChange={e=>setInviteRole(e.target.value)}>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button disabled={!emailOk} onClick={addMember} className={`px-3 py-1.5 rounded-xl border ${emailOk ? "bg-white hover:bg-gray-50" : "opacity-50 cursor-not-allowed"}`}>Add</button>
                </div>
                <div className="border rounded-2xl">
                  <div className="p-2 border-b text-xs font-medium bg-gray-50 rounded-t-2xl">Project Members</div>
                  <div className="max-h-60 overflow-y-auto divide-y">
                    {(memberships[project?.id] || []).map((m) => (
                      <div key={m.email} className="flex items-center justify-between p-2">
                        <div>
                          <div className="text-sm">{m.email}</div>
                          <div className="text-xs text-gray-600">Role: {m.role}</div>
                        </div>
                        <button onClick={()=>removeMember(m.email)} className="px-2 py-1 rounded-xl border hover:bg-gray-50">Remove</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </fm.div>
          </fm.div>
        )}
      </AnimatePresence>
    </div>
  );
}
