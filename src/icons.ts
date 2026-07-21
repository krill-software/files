// Lucide icons as SVG strings - https://lucide.dev
// Downloaded from https://github.com/lucide-icons/lucide/tree/main/icons

const LUCIDE_SVGS: Record<string, string> = {
  folder: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /></svg>`,
  file: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><polyline points="14 2 14 8 20 8" /></svg>`,
  "file-text": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><line x1="9" x2="15" y1="13" y2="13" /><line x1="9" x2="15" y1="17" y2="17" /></svg>`,
  "file-json": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M9 10a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1" /><path d="M15 10a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1" /><path d="M11 14h2" /></svg>`,
  code: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>`,
  image: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>`,
  download: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>`,
  music: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="18" r="3" /><circle cx="20" cy="16" r="3" /><path d="M9 18V4a2 2 0 0 0-2-2h0a2 2 0 0 0-2 2v14" /><path d="M23 16V6a2 2 0 0 0-2-2h0a2 2 0 0 0-2 2v12" /></svg>`,
  video: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect width="15" height="14" x="1" y="5" rx="2" ry="2" /></svg>`,
  archive: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1" /><path d="M4 8v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /><line x1="10" x2="10" y1="12" y2="17" /><line x1="14" x2="14" y1="12" y2="17" /></svg>`,
  home: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21H9a2 2 0 0 1-2-2V10.87a2 2 0 0 1 .84-1.6l6-4.5a2 2 0 0 1 2.32 0l6 4.5A2 2 0 0 1 22 10.87V19a2 2 0 0 1-2 2h-6" /><polyline points="9 21 9 13 15 13 15 21" /></svg>`,
};

export function getLucideSVG(name: string): SVGSVGElement {
  const svgString = LUCIDE_SVGS[name];
  if (!svgString) {
    console.warn(`Lucide icon "${name}" not found`);
    return document.createElementNS("http://www.w3.org/2000/svg", "svg");
  }

  const div = document.createElement("div");
  div.innerHTML = svgString;
  const svg = div.querySelector("svg") as SVGSVGElement;

  // Set size and color
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.style.color = "#DD7596";

  return svg;
}
