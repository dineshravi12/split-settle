import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-fab",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./fab.component.html",
  styleUrls: ["./fab.component.scss"],
})
export class FabComponent implements OnInit {
  @Input() icon = "pi-plus";
  @Input() label = "Create";
  @Input() ariaLabel = "Create";
  @Output() fabClick = new EventEmitter<void>();

  pulse = false;

  ngOnInit(): void {
    if (typeof localStorage === "undefined") return;
    this.pulse = localStorage.getItem("fab_hinted") !== "true";
  }

  onClick(): void {
    if (this.pulse) {
      try {
        localStorage.setItem("fab_hinted", "true");
      } catch {
        /* ignore */
      }
      this.pulse = false;
    }
    this.fabClick.emit();
  }
}
