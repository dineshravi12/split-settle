import { Component, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { ReactiveFormsModule } from "@angular/forms";
import {
  trigger,
  transition,
  animate,
  keyframes,
  style,
} from "@angular/animations";
import { ToastModule } from "primeng/toast";
import { MessageService } from "primeng/api";
import { AuthService } from "../../../core/services/auth.service";
import { AuthResponse } from "../../../core/models/auth.model";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, ToastModule, ReactiveFormsModule, RouterLink],
  providers: [MessageService],
  templateUrl: "./login.component.html",
  styleUrls: ["./login.component.scss"],
  animations: [
    trigger("shake", [
      transition("* => shaking", [
        animate(
          "0.55s",
          keyframes([
            style({ transform: "translateX(0)", offset: 0 }),
            style({ transform: "translateX(-12px)", offset: 0.15 }),
            style({ transform: "translateX(12px)", offset: 0.35 }),
            style({ transform: "translateX(-8px)", offset: 0.55 }),
            style({ transform: "translateX(8px)", offset: 0.75 }),
            style({ transform: "translateX(0)", offset: 1 }),
          ]),
        ),
      ]),
    ]),
  ],
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private messageService = inject(MessageService);

  loginForm: FormGroup = this.fb.group({
    email: ["", [Validators.required, Validators.email]],
    password: ["", Validators.required],
  });
  loading = signal(false);
  showPassword = signal(false);
  shakeState = signal<"idle" | "shaking">("idle");

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.triggerShake();
      return;
    }

    this.loading.set(true);
    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: (response: AuthResponse) => {
        this.authService.saveSession(response);
        this.router.navigate(["/dashboard"]);
        this.loading.set(false);
      },
      error: (error: any) => {
        this.loading.set(false);
        this.triggerShake();
        this.messageService.add({
          severity: "error",
          summary: "Login Failed",
          detail: error?.error?.message || "Invalid credentials",
        });
      },
    });
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  private triggerShake(): void {
    this.shakeState.set("shaking");
    setTimeout(() => this.shakeState.set("idle"), 600);
  }
}
