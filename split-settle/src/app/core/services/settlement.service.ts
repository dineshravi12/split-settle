import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import { Settlement } from "../models/settlement.model";

@Injectable({
  providedIn: "root",
})
export class SettlementService {
  private apiUrl = `${environment.apiUrl}/settlements`;

  constructor(private http: HttpClient) {}

  getSettlements(groupId: number): Observable<Settlement[]> {
    return this.http.get<Settlement[]>(`${this.apiUrl}/${groupId}`);
  }

  settleUp(
    groupId: number,
    fromUserId: number,
    toUserId: number,
  ): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/settle`, {
      groupId,
      fromUserId,
      toUserId,
    });
  }
}
