const APP_VERSION = import.meta.env.VITE_APP_VERSION;
const STORAGE_KEY = "app_version";

export function checkAppVersion() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved !== APP_VERSION) {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEY, APP_VERSION);
    window.location.replace("/login");
  }
}