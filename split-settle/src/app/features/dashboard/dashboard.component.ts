import { Component, OnDestroy, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { forkJoin, of } from "rxjs";
import { catchError, switchMap, map } from "rxjs/operators";
import { GroupService } from "../../core/services/group.service";
import { SettlementService } from "../../core/services/settlement.service";
import { AuthService } from "../../core/services/auth.service";
import { Group } from "../../core/models/group.model";
import { Settlement } from "../../core/models/settlement.model";
import { SkeletonLoaderComponent } from "../../shared/components/skeleton-loader/skeleton-loader.component";
import { FabComponent } from "../../shared/components/fab/fab.component";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [CommonModule, SkeletonLoaderComponent, FabComponent],
  templateUrl: "./dashboard.component.html",
  styleUrls: ["./dashboard.component.scss"],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private groupService = inject(GroupService);
  private settlementService = inject(SettlementService);
  private authService = inject(AuthService);
  private router = inject(Router);

  loading = true;
  greeting = "";
  userName = "";
  groups: Group[] = [];
  totalGroups = 0;
  totalYouOwe = 0;
  totalOwedToYou = 0;
  displayYouOwe = 0;
  displayOwedToYou = 0;
  displayGroups = 0;
  recentGroups: Group[] = [];

  private counters: any[] = [];

  ngOnInit(): void {
    this.userName = this.authService.getCurrentUserName();
    this.greeting = this.buildGreeting();
    this.loadDashboard();
  }

  ngOnDestroy(): void {
    this.counters.forEach((id) => clearInterval(id));
  }

  loadDashboard(): void {
    this.loading = true;
    const userId = this.authService.getCurrentUserId();
    this.groupService
      .getGroups()
      .pipe(
        switchMap((groups: Group[]) => {
          this.groups = groups;
          this.totalGroups = groups.length;
          this.recentGroups = groups.slice(-3).reverse();
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
              if (s.fromId === userId) owe += s.amount;
              if (s.toId === userId) owed += s.amount;
            }
          }
          return { owe, owed };
        }),
      )
      .subscribe({
        next: ({ owe, owed }) => {
          this.totalYouOwe = owe;
          this.totalOwedToYou = owed;
          this.loading = false;
          setTimeout(() => this.startCounters(), 50);
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  openGroup(id: number): void {
    this.router.navigate(["/groups", id]);
  }

  goToGroups(): void {
    this.router.navigate(["/groups"]);
  }

  private buildGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }

  private startCounters(): void {
    this.counters.forEach((id) => clearInterval(id));
    this.counters = [];
    this.animate("displayYouOwe", this.totalYouOwe);
    this.animate("displayOwedToYou", this.totalOwedToYou);
    this.animate("displayGroups", this.totalGroups, true);
  }

  private animate(key: string, target: number, integer = false): void {
    if (target <= 0) {
      (this as any)[key] = 0;
      return;
    }
    const duration = 900;
    const steps = 32;
    const stepTime = duration / steps;
    const increment = target / steps;
    let current = 0;
    (this as any)[key] = 0;
    const id: any = setInterval(() => {
      current = Math.min(current + increment, target);
      (this as any)[key] = integer ? Math.round(current) : current;
      if (current >= target) {
        (this as any)[key] = target;
        clearInterval(id);
      }
    }, stepTime);
    this.counters.push(id);
  }
}
