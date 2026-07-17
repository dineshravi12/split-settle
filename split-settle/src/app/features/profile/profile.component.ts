import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { forkJoin, of } from "rxjs";
import { catchError, switchMap, map } from "rxjs/operators";
import { AuthService } from "../../core/services/auth.service";
import { ThemeService } from "../../core/services/theme.service";
import { GroupService } from "../../core/services/group.service";
import { SettlementService } from "../../core/services/settlement.service";
import { Group } from "../../core/models/group.model";
import { Settlement } from "../../core/models/settlement.model";
import { SkeletonLoaderComponent } from "../../shared/components/skeleton-loader/skeleton-loader.component";

@Component({
  selector: "app-profile",
  standalone: true,
  imports: [CommonModule, SkeletonLoaderComponent],
  templateUrl: "./profile.component.html",
  styleUrls: ["./profile.component.scss"],
})
export class ProfileComponent implements OnInit {
  private authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  private groupService = inject(GroupService);
  private settlementService = inject(SettlementService);
  private router = inject(Router);

  loading = true;
  userName = "";
  userId = 0;
  memberSince = "";
  totalGroups = 0;
  totalYouOwe = 0;
  totalOwedToYou = 0;
  netBalance = 0;

  ngOnInit(): void {
    this.userName = this.authService.getCurrentUserName();
    this.userId = this.authService.getCurrentUserId();
    this.memberSince = new Date().toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
    this.loadStats();
  }

  get initial(): string {
    return this.userName ? this.userName.charAt(0).toUpperCase() : "?";
  }

  loadStats(): void {
    this.loading = true;
    this.groupService
      .getGroups()
      .pipe(
        switchMap((groups: Group[]) => {
          this.totalGroups = groups.length;
          if (groups.length === 0) {
            return of([] as Settlement[][]);
          }
          const calls = groups.map((g) =>
            this.settlementService
              .getSettlements(g.id)
              .pipe(catchError(() => of([] as Settlement[]))),
          );
          return forkJoin(calls);
        }),
        map((settlementsPerGroup: Settlement[][]) => {
          let owe = 0;
          let owed = 0;
          for (const list of settlementsPerGroup) {
            for (const s of list) {
              if (s.fromId === this.userId) owe += s.amount;
              if (s.toId === this.userId) owed += s.amount;
            }
          }
          return { owe, owed };
        }),
      )
      .subscribe({
        next: ({ owe, owed }) => {
          this.totalYouOwe = owe;
          this.totalOwedToYou = owed;
          this.netBalance = owed - owe;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  goToGroups(): void {
    this.router.navigate(["/groups"]);
  }

  logout(): void {
    this.authService.logout();
  }
}
