import { Component, HostListener, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterLink, RouterLinkActive } from "@angular/router";
import { AuthService } from "../../../core/services/auth.service";
import { ThemeService } from "../../../core/services/theme.service";

@Component({
  selector: "app-header",
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: "./header.component.html",
  styleUrls: ["./header.component.scss"],
})
export class HeaderComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  readonly themeService = inject(ThemeService);

  userName = this.authService.getCurrentUserName();
  menuOpen = false;

  get initial(): string {
    return this.userName ? this.userName.charAt(0).toUpperCase() : "?";
  }

  goHome(): void {
    this.menuOpen = false;
    this.router.navigate(["/dashboard"]);
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen = !this.menuOpen;
  }

  logout(): void {
    this.menuOpen = false;
    this.authService.logout();
  }

  @HostListener("document:click")
  closeMenu(): void {
    this.menuOpen = false;
  }
}
