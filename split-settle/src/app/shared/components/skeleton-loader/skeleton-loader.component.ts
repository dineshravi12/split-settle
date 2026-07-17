import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";

export type SkeletonType = "card" | "list" | "stat" | "text" | "avatar";

@Component({
  selector: "app-skeleton-loader",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./skeleton-loader.component.html",
  styleUrls: ["./skeleton-loader.component.scss"],
})
export class SkeletonLoaderComponent {
  @Input() type: SkeletonType = "card";
  @Input() rows = 3;

  get rowList(): number[] {
    return Array.from({ length: this.rows }, (_, i) => i);
  }
}
