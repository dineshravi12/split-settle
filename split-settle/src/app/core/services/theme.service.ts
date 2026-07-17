import { Injectable, signal, effect } from "@angular/core";

@Injectable({ providedIn: "root" })
export class ThemeService {
  readonly isDark = signal<boolean>(this.readInitial());

  constructor() {
    this.apply(this.isDark());
    effect(() => this.apply(this.isDark()));
  }

  toggle(): void {
    this.isDark.update((v) => !v);
  }

  setDark(dark: boolean): void {
    this.isDark.set(dark);
  }

  private readInitial(): boolean {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  }

  private apply(dark: boolean): void {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      /* ignore quota / private mode */
    }
  }
}
