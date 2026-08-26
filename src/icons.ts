// Lucide glyphs (https://lucide.dev). Explicit imports so only the icons the
// app actually uses end up in the bundle.
import {
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  createElement,
  Download,
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileJson,
  FileText,
  FileVideo,
  Folder,
  House,
  Image,
  Monitor,
  Music,
  Video,
  type IconNode,
} from "lucide";

const ICONS: Record<string, IconNode> = {
  "arrow-left": ArrowLeft,
  "arrow-up": ArrowUp,
  "chevron-down": ChevronDown,
  "chevron-up": ChevronUp,
  download: Download,
  file: File,
  "file-archive": FileArchive,
  "file-audio": FileAudio,
  "file-code": FileCode,
  "file-image": FileImage,
  "file-json": FileJson,
  "file-text": FileText,
  "file-video": FileVideo,
  folder: Folder,
  home: House,
  image: Image,
  monitor: Monitor,
  music: Music,
  video: Video,
};

/** Extension → glyph. Anything unlisted gets the plain `file`. */
const EXT_ICONS: Record<string, string> = {
  json: "file-json",
  js: "file-code", ts: "file-code", py: "file-code", rs: "file-code", go: "file-code",
  rb: "file-code", php: "file-code", c: "file-code", h: "file-code", cpp: "file-code",
  sh: "file-code", css: "file-code", html: "file-code", toml: "file-code", yml: "file-code", yaml: "file-code",
  txt: "file-text", md: "file-text", pdf: "file-text", csv: "file-text", log: "file-text",
  mp3: "file-audio", wav: "file-audio", flac: "file-audio", aac: "file-audio", ogg: "file-audio", m4a: "file-audio",
  mp4: "file-video", webm: "file-video", mkv: "file-video", mov: "file-video", avi: "file-video",
  png: "file-image", jpg: "file-image", jpeg: "file-image", gif: "file-image", webp: "file-image", svg: "file-image",
  zip: "file-archive", tar: "file-archive", gz: "file-archive", rar: "file-archive", "7z": "file-archive",
  bz2: "file-archive", xz: "file-archive", zst: "file-archive", deb: "file-archive", appimage: "file-archive",
};

/** A Lucide glyph as an inline SVG, stroked in `currentColor`. */
export function icon(name: string, size = 16): SVGElement {
  const svg = createElement(ICONS[name] ?? File);
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  return svg;
}

export function fileIcon(name: string, isDir: boolean): SVGElement {
  if (isDir) return icon("folder");
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  return icon(EXT_ICONS[ext] ?? "file");
}
