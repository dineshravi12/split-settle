import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import { Expense } from "../models/expense.model";

export interface AddExpenseRequest {
  groupId: number;
  description: string;
  amount: number;
  category: string;
  paidBy: number;
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

  addExpense(data: AddExpenseRequest): Observable<Expense> {
    return this.http.post<Expense>(this.apiUrl, data);
  }

  deleteExpense(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
