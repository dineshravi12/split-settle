import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink, RouterLinkActive } from "@angular/router";

@Component({
  selector: "app-bottom-nav",
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: "./bottom-nav.component.html",
  styleUrls: ["./bottom-nav.component.scss"],
})
export class BottomNavComponent {
  readonly items = [
    { path: "/dashboard", icon: "pi-home", label: "Home" },
    { path: "/groups", icon: "pi-users", label: "Groups" },
    { path: "/profile", icon: "pi-user", label: "Profile" },
  ];
}
