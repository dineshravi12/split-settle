import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { ToolbarModule } from "primeng/toolbar";
import { ButtonModule } from "primeng/button";
import { AuthService } from "../../../core/services/auth.service";

@Component({
  selector: "app-header",
  standalone: true,
  imports: [CommonModule, ToolbarModule, ButtonModule],
  templateUrl: "./header.component.html",
  styleUrls: ["./header.component.scss"],
})
export class HeaderComponent {
  userName = "";

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {
    this.userName = this.authService.getCurrentUserName();
  }

  goHome(): void {
    this.router.navigate(["/dashboard"]);
  }

  logout(): void {
    this.authService.logout();
  }
}
