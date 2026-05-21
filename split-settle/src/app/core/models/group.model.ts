import { User } from './user.model';

export interface Group {
  id: number;
  name: string;
  createdBy: number;
  members: User[];
}