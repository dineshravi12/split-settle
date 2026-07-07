import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/api/auth`;

  constructor(private http: HttpClient, private router: Router) {}

  register(name: string, email: string, password: string): Observable<AuthResponse> {
    const body: RegisterRequest = { name, email, password };
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, body);
  }

  login(email: string, password: string): Observable<AuthResponse> {
    const body: LoginRequest = { email, password };
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, body);
  }

  logout(): void {
    localStorage.removeItem('split_token');
    localStorage.removeItem('split_userId');
    localStorage.removeItem('split_name');
    this.router.navigate(['/login']);
  }

  saveSession(response: AuthResponse): void {
    localStorage.setItem('split_token', response.token);
    localStorage.setItem('split_userId', response.userId.toString());
    localStorage.setItem('split_name', response.name);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('split_token');
  }

  getToken(): string {
    return localStorage.getItem('split_token') ?? '';
  }

  getCurrentUserId(): number {
    const id = localStorage.getItem('split_userId');
    return id ? +id : 0;
  }

  getCurrentUserName(): string {
    return localStorage.getItem('split_name') ?? '';
  }
}
