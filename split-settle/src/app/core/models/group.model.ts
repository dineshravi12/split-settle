export interface GroupMember {
  userId: number;
  name: string;
  email: string;
}

export interface Group {
  id: number;
  name: string;
  createdBy: number;
  budget: number | null;
  members: GroupMember[];
}