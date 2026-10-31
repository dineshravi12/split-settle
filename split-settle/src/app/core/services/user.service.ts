import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import { UserProfile } from "../models/user.model";

@Injectable({
  providedIn: "root",
})
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/users`;

  getMe(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}/me`);
  }

  updateUpiId(upiId: string | null): Observable<UserProfile> {
    return this.http.put<UserProfile>(`${this.apiUrl}/me`, { upiId });
  }
}
