import {
  createIcons,
  BarChart3,
  Calendar,
  CalendarRange,
  HelpCircle,
  BookOpen,
  Target,
  Zap,
  Shield,
  Brain,
  CheckCircle,
  Pencil,
  Save,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Trophy,
  AlertTriangle,
  Table,
  MessageSquare,
  Printer,
  Settings,
  Plus,
  Trash2,
  Download,
  Upload,
  Star,
  EyeOff,
  Eye,
} from "lucide";

const ICONS = {
  BarChart3,
  Calendar,
  CalendarRange,
  HelpCircle,
  BookOpen,
  Target,
  Zap,
  Shield,
  Brain,
  CheckCircle,
  Pencil,
  Save,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Trophy,
  AlertTriangle,
  Table,
  MessageSquare,
  Printer,
  Settings,
  Plus,
  Trash2,
  Download,
  Upload,
  Star,
  EyeOff,
  Eye,
};

// Icons available for user-created categories (data-lucide names).
export const CATEGORY_ICONS = [
  "book-open",
  "target",
  "zap",
  "shield",
  "brain",
  "check-circle",
  "star",
];

export function refreshIcons() {
  createIcons({ icons: ICONS });
}

export function showToast(msg, color) {
  const toast = document.getElementById("toast-msg");
  toast.textContent = msg;
  toast.style.background = color || "#22c55e";
  toast.style.color = color === "#ef4444" ? "#fff" : "#0f1117";
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2500);
}

export function getScoreColor(v) {
  if (v >= 9) return { bg: "rgba(34,197,94,0.15)", text: "#22c55e", label: "Elite" };
  if (v >= 7) return { bg: "rgba(59,130,246,0.15)", text: "#3b82f6", label: "Solid" };
  if (v >= 5) return { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", label: "Developing" };
  if (v >= 3) return { bg: "rgba(249,115,22,0.15)", text: "#f97316", label: "Needs Work" };
  return { bg: "rgba(239,68,68,0.15)", text: "#ef4444", label: "Below Standard" };
}

export function getGradeInfo(v) {
  if (v >= 9) return { letter: "A", color: "#22c55e", label: "Elite" };
  if (v >= 7) return { letter: "B", color: "#14b8a6", label: "Solid" };
  if (v >= 5) return { letter: "C", color: "#f59e0b", label: "Developing" };
  if (v >= 3) return { letter: "D", color: "#f97316", label: "Needs Work" };
  return { letter: "F", color: "#ef4444", label: "Reset Required" };
}

// Local-timezone YYYY-MM-DD. Never use toISOString() for calendar dates —
// in NZ (+12/+13) it shifts the date for most of the day.
export function ymd(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function getMonday(d) {
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = dt.getDay();
  const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
  dt.setDate(diff);
  return dt;
}

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
