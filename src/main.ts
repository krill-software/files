import "@krill-software/desktop-ui/styles";
import "./styles.css";

import { mountChrome } from "@krill-software/desktop-ui";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";

async function boot(): Promise<void> {
  const version = await getVersion().catch(() => "0.0.0");

  const chrome = mountChrome({
    productName: "Files",
    version,
    layout: "app",
    actions: {},
    showAuxPane: true,
    updater: true,
  });

  // Placeholder: main content area
  const main = document.createElement("div");
  main.className = "files-main";
  main.textContent = "Files browser — under construction";
  chrome.mainContent!.appendChild(main);

  // Placeholder: sidebar
  const sidebar = document.createElement("div");
  sidebar.className = "files-sidebar";
  const shortcuts = document.createElement("nav");
  shortcuts.className = "shortcuts";
  sidebar.appendChild(shortcuts);
  chrome.aux!.appendChild(sidebar);

  await getCurrentWindow().show().catch(() => {});
}

boot().catch((e) => {
  console.error("boot failed:", e);
});
