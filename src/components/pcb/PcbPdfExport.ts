import jsPDF from "jspdf";
import type { PcbTask, PcbTaskHistory, PcbTaskNote } from "@/lib/pcb";
import { PCB_STATUS_LABEL, ROOT_CAUSES } from "@/lib/pcb";

async function imageToDataUrl(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const reader = new FileReader();
    const data: string = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const img = new Image();
    img.src = data;
    await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
    return { data, w: img.naturalWidth || 800, h: img.naturalHeight || 600 };
  } catch {
    return null;
  }
}

export async function exportPcbTaskPdf(opts: {
  task: PcbTask;
  history: PcbTaskHistory[];
  notes: PcbTaskNote[];
  photos: { url: string; caption: string | null }[];
}) {
  const { task, history, notes, photos } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  function ensure(space: number) {
    if (y + space > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  }
  function text(t: string, opts?: { size?: number; bold?: boolean; color?: [number, number, number] }) {
    doc.setFontSize(opts?.size ?? 10);
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    if (opts?.color) doc.setTextColor(...opts.color); else doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(t, pageW - margin * 2);
    ensure(lines.length * (opts?.size ?? 10) * 1.3);
    doc.text(lines, margin, y);
    y += lines.length * (opts?.size ?? 10) * 1.3;
  }

  text("PCB Repair Report", { size: 18, bold: true });
  y += 6;
  text(task.board_name, { size: 14, bold: true });
  text(`Status: ${PCB_STATUS_LABEL[task.status]}    Priority: ${task.priority}    Created: ${new Date(task.created_at).toLocaleString()}`, { size: 9, color: [110, 110, 110] });
  if (task.project) text(`Project: ${task.project.code} — ${task.project.name}`, { size: 9, color: [110, 110, 110] });
  if (task.assignee) text(`Assignee: ${task.assignee.name}`, { size: 9, color: [110, 110, 110] });
  y += 6;

  text("Issue", { size: 12, bold: true }); text(task.issue);
  y += 6;

  text("Root Cause", { size: 12, bold: true });
  if (task.root_cause) {
    const rc = ROOT_CAUSES.find((r) => r.value === task.root_cause)?.label ?? task.root_cause;
    text(rc, { bold: true });
    if (task.root_cause_notes) text(task.root_cause_notes);
  } else text("Not specified.", { color: [150, 150, 150] });
  y += 6;

  text("Status History", { size: 12, bold: true });
  for (const h of history) {
    const from = h.from_status ? PCB_STATUS_LABEL[h.from_status] : "—";
    const to = PCB_STATUS_LABEL[h.to_status];
    text(`${new Date(h.created_at).toLocaleString()}    ${from} → ${to}`, { size: 9 });
  }
  y += 6;

  if (notes.length) {
    text("Notes", { size: 12, bold: true });
    for (const n of notes) {
      text(new Date(n.created_at).toLocaleString(), { size: 8, color: [120, 120, 120] });
      text(n.body);
      y += 4;
    }
  }

  if (photos.length) {
    doc.addPage(); y = margin;
    text("Photos", { size: 14, bold: true });
    for (const p of photos) {
      const img = await imageToDataUrl(p.url);
      if (!img) continue;
      const maxW = pageW - margin * 2;
      const maxH = 320;
      let w = img.w, h = img.h;
      const r = Math.min(maxW / w, maxH / h);
      w = w * r; h = h * r;
      ensure(h + 40);
      try { doc.addImage(img.data, "JPEG", margin, y, w, h); } catch { try { doc.addImage(img.data, "PNG", margin, y, w, h); } catch {} }
      y += h + 4;
      if (p.caption) text(p.caption, { size: 9, color: [110, 110, 110] });
      y += 8;
    }
  }

  doc.save(`pcb-${task.board_name.replace(/[^a-z0-9]+/gi, "-")}-${task.id.slice(0, 6)}.pdf`);
}
