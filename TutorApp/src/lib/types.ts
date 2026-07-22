export interface Subscription {
  total: number;
  remaining: number;
  startDate: string;
}

export interface Student {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  rate: number;
  duration: number;
  favorite: boolean;
  color: string | null;
  note: string;
  subscription: Subscription | null;
  joinedAt: string;
  birthDate?: string;
  grade?: string;
  school?: string;
  goal?: string;
}

export interface Group {
  id: string;
  name: string;
  memberIds: string[];
}

export type LessonStatus = "scheduled" | "cancelled";
export type PaymentStatus = "pending" | "paid";

export interface Lesson {
  id: string;
  studentId?: string;
  groupId?: string;
  title: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  status: LessonStatus;
  paymentStatus: PaymentStatus;
}

export type HomeworkStatus = "pending" | "done";

export interface Homework {
  id: string;
  studentId: string;
  studentName: string;
  title: string;
  due: string | null;
  status: HomeworkStatus;
}

export interface ChatMessage {
  id: string;
  from: "me" | "student";
  text: string;
  at: number;
}

export type MessagesByStudent = Record<string, ChatMessage[]>;

export interface Task {
  id: string;
  topic: string;
  subtopic: string;
  grade: string;
  subject: string;
  level: string;
  type: string;
  text: string;
  solution: string;
  errors: string;
  comment: string;
  createdAt: number;
}

export interface MethodNote {
  id: string;
  topic: string;
  grade: string;
  subject: string;
  content: string;
  updatedAt: number;
}

export interface WeeklyTemplateSlot {
  id: string;
  weekday: number; // 0=Mon..6=Sun
  time: string;
  duration: number;
  price: number;
  studentId?: string;
  groupId?: string;
  title: string;
}

export type ViewId =
  | "students"
  | "student-detail"
  | "groups"
  | "schedule"
  | "messages"
  | "homework"
  | "tasks"
  | "notes"
  | "stats";
