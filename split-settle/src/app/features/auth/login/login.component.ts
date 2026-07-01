import { Component } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from "../../../core/services/auth.service";
import { AuthResponse } from "../../../core/models/auth.model";
import { ToastModule } from "primeng/toast";
import { MessageService } from "primeng/api";
import { ReactiveFormsModule } from "@angular/forms";
import { InputTextModule } from "primeng/inputtext";
import { PasswordModule } from "primeng/password";
import { ButtonModule } from "primeng/button";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [
    ToastModule,
    ReactiveFormsModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    RouterLink,
  ],
  providers: [MessageService],
  templateUrl: "./login.component.html",
  styleUrls: ["./login.component.scss"],
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private messageService: MessageService,
  ) {
    this.loginForm = this.fb.group({
      email: ["", [Validators.required, Validators.email]],
      password: ["", Validators.required],
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;
    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: (response: AuthResponse) => {
        this.authService.saveSession(response);
        this.router.navigate(["/dashboard"]);
        this.loading = false;
      },
      error: (error: any) => {
        this.loading = false;
        this.messageService.add({
          severity: "error",
          summary: "Login Failed",
          detail: error.error?.message || "Invalid credentials",
        });
      },
    });
  }
}
