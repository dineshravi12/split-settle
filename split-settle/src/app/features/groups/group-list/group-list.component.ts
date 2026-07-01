import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from "@angular/forms";
import { ButtonModule } from "primeng/button";
import { DialogModule } from "primeng/dialog";
import { InputTextModule } from "primeng/inputtext";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { ToastModule } from "primeng/toast";
import { MessageService } from "primeng/api";
import { GroupService } from "../../../core/services/group.service";
import { Group } from "../../../core/models/group.model";
import { HeaderComponent } from "../../../shared/components/header/header.component";

@Component({
  selector: "app-group-list",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    ProgressSpinnerModule,
    ToastModule,
    HeaderComponent,
  ],
  providers: [MessageService],
  templateUrl: "./group-list.component.html",
  styleUrls: ["./group-list.component.scss"],
})
export class GroupListComponent implements OnInit {
  loading = true;
  groups: Group[] = [];
  showDialog = false;
  submitting = false;
  groupForm: FormGroup;

  constructor(
    private groupService: GroupService,
    private router: Router,
    private fb: FormBuilder,
    private messageService: MessageService,
  ) {
    this.groupForm = this.fb.group({
      name: ["", [Validators.required, Validators.minLength(3)]],
    });
  }

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
          summary: "Group Created",
          detail: `"${group.name}" was created`,
        });
      },
      error: (error) => {
        this.submitting = false;
        this.messageService.add({
          severity: "error",
          summary: "Error",
          detail: error.error?.message || "Failed to create group",
        });
      },
    });
  }

  openGroup(id: number): void {
    this.router.navigate(["/groups", id]);
  }
}
