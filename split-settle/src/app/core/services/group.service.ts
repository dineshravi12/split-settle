import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import { Group } from "../models/group.model";

@Injectable({
  providedIn: "root",
})
export class GroupService {
  private apiUrl = `${environment.apiUrl}/groups`;

  constructor(private http: HttpClient) {}

  getGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(this.apiUrl);
  }

  getGroup(id: number): Observable<Group> {
    return this.http.get<Group>(`${this.apiUrl}/${id}`);
  }

  createGroup(name: string): Observable<Group> {
    return this.http.post<Group>(this.apiUrl, { name });
  }

  addMember(groupId: number, email: string): Observable<Group> {
    return this.http.post<Group>(`${this.apiUrl}/${groupId}/members`, {
      email,
    });
  }
}
