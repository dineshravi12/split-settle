import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { forkJoin, of } from "rxjs";
import { catchError, switchMap, map } from "rxjs/operators";
import { CardModule } from "primeng/card";
import { ButtonModule } from "primeng/button";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { GroupService } from "../../core/services/group.service";
import { SettlementService } from "../../core/services/settlement.service";
import { AuthService } from "../../core/services/auth.service";
import { Group } from "../../core/models/group.model";
import { Settlement } from "../../core/models/settlement.model";
import { HeaderComponent } from "../../shared/components/header/header.component";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    ProgressSpinnerModule,
    HeaderComponent,
  ],
  templateUrl: "./dashboard.component.html",
  styleUrls: ["./dashboard.component.scss"],
})
export class DashboardComponent implements OnInit {
  loading = true;
  groups: Group[] = [];
  totalGroups = 0;
  totalYouOwe = 0;
  totalOwedToYou = 0;
  recentGroups: Group[] = [];

  constructor(
    private groupService: GroupService,
    private settlementService: SettlementService,
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
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
}
