import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from "@angular/forms";
import {
  trigger,
  transition,
  query,
  stagger,
  animate,
  style,
} from "@angular/animations";
import { ToastModule } from "primeng/toast";
import { MessageService } from "primeng/api";
import { GroupService } from "../../../core/services/group.service";
import { Group } from "../../../core/models/group.model";
import { SkeletonLoaderComponent } from "../../../shared/components/skeleton-loader/skeleton-loader.component";
import { FabComponent } from "../../../shared/components/fab/fab.component";

@Component({
  selector: "app-group-list",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToastModule,
    SkeletonLoaderComponent,
    FabComponent,
  ],
  providers: [MessageService],
  templateUrl: "./group-list.component.html",
  styleUrls: ["./group-list.component.scss"],
  animations: [
    trigger("listStagger", [
      transition("* => *", [
        query(
          ":enter",
          [
            style({ opacity: 0, transform: "translateY(16px)" }),
            stagger(60, [
              animate(
                "320ms cubic-bezier(0.16, 1, 0.3, 1)",
                style({ opacity: 1, transform: "translateY(0)" }),
              ),
            ]),
          ],
          { optional: true },
        ),
      ]),
    ]),
  ],
})
export class GroupListComponent implements OnInit {
  private groupService = inject(GroupService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);

  loading = true;
  groups: Group[] = [];
  showDialog = false;
  submitting = false;
  groupForm: FormGroup = this.fb.group({
    name: ["", [Validators.required, Validators.minLength(3)]],
  });

  ngOnInit(): void {
    this.loadGroups();
  }

  loadGroups(): void {
    this.loading = true;
    this.groupService.getGroups().subscribe({
      next: (groups) => {
        this.groups = groups;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.messageService.add({
          severity: "error",
          summary: "Error",
          detail: "Failed to load groups",
        });
      },
    });
  }

  openDialog(): void {
    this.groupForm.reset({ name: "" });
    this.showDialog = true;
  }

  closeDialog(): void {
    if (this.submitting) return;
    this.showDialog = false;
  }

  createGroup(): void {
    if (this.groupForm.invalid || this.submitting) {
      this.groupForm.markAllAsTouched();
      return;
    }
    this.submitting = true;
    const name = this.groupForm.value.name as string;
    this.groupService.createGroup(name).subscribe({
      next: (group) => {
        this.groups = [...this.groups, group];
        this.submitting = false;
        this.showDialog = false;
        this.messageService.add({
          severity: "success",
          summary: "Group created",
          detail: `"${group.name}" is ready`,
        });
      },
      error: (error) => {
        this.submitting = false;
        this.messageService.add({
          severity: "error",
          summary: "Error",
          detail: error?.error?.message || "Failed to create group",
        });
      },
    });
  }

  openGroup(id: number): void {
    this.router.navigate(["/groups", id]);
  }

  trackId(_: number, group: Group): number {
    return group.id;
  }
}
