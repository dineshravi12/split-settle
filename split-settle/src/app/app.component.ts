import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  ChildrenOutletContexts,
  NavigationEnd,
  Router,
  RouterOutlet,
} from "@angular/router";
import { toSignal } from "@angular/core/rxjs-interop";
import { filter, map, startWith } from "rxjs/operators";
import { AuthService } from "./core/services/auth.service";
import { ThemeService } from "./core/services/theme.service";
import { HeaderComponent } from "./shared/components/header/header.component";
import { BottomNavComponent } from "./shared/components/bottom-nav/bottom-nav.component";
import { routeAnimations } from "./shared/animations/route-animations";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, BottomNavComponent],
  animations: [routeAnimations],
  template: `
    <ng-container *ngIf="isChromeVisible(); else fullBleed">
      <app-header></app-header>
      <main class="route-host" [@routeAnimations]="getAnimationKey(outlet)">
        <router-outlet #outlet="outlet"></router-outlet>
      </main>
      <app-bottom-nav *ngIf="isLoggedIn()"></app-bottom-nav>
    </ng-container>

    <ng-template #fullBleed>
      <main class="route-host route-host--full" [@routeAnimations]="getAnimationKey(fbOutlet)">
        <router-outlet #fbOutlet="outlet"></router-outlet>
      </main>
    </ng-template>
  `,
})
export class AppComponent {
  private router = inject(Router);
  private contexts = inject(ChildrenOutletContexts);
  private authService = inject(AuthService);
  // ensure ThemeService is instantiated app-wide (applies data-theme)
  private themeService = inject(ThemeService);

  private currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.initialPath()),
    ),
    { initialValue: this.initialPath() },
  );

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  isChromeVisible(): boolean {
    const url = this.currentUrl();
    return !(
      url.startsWith("/login") ||
      url.startsWith("/register") ||
      url.startsWith("/onboarding")
    );
  }

  getAnimationKey(outlet: RouterOutlet | null): string {
    const ctx = this.contexts.getContext("primary");
    return (
      ctx?.route?.snapshot?.data?.["animation"] ??
      outlet?.activatedRouteData?.["animation"] ??
      "root"
    );
  }

  private initialPath(): string {
    if (typeof window !== "undefined" && window.location) {
      return window.location.pathname || "/";
    }
    return this.router.url;
  }
}
