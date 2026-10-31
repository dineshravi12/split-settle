import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import { Expense, SplitType } from "../models/expense.model";

export interface ExpenseRequest {
  groupId: number;
  description: string;
  amount: number;
  category: string;
  paidBy: number;
  splitType: SplitType;
  // EQUAL: participants (value null); PERCENTAGE/EXACT: value per member
  splits: { userId: number; value: number | null }[];
}

@Injectable({
  providedIn: "root",
})
export class ExpenseService {
  private apiUrl = `${environment.apiUrl}/expenses`;

  constructor(private http: HttpClient) {}

  getExpenses(groupId: number): Observable<Expense[]> {
    return this.http.get<Expense[]>(`${this.apiUrl}/group/${groupId}`);
  }

  addExpense(data: ExpenseRequest): Observable<Expense> {
    return this.http.post<Expense>(this.apiUrl, data);
  }

  updateExpense(id: number, data: ExpenseRequest): Observable<Expense> {
    return this.http.put<Expense>(`${this.apiUrl}/${id}`, data);
  }

  deleteExpense(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
