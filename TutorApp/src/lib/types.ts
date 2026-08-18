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
  comment?: string;
  /** Methodology topic covered in this lesson (see MethodNote). */
  noteId?: string;
  /** Tutor's plan for the next lesson, set when reviewing this one. */
  nextPlan?: string;
  /** Record of the lesson — e.g. a photo/PDF of the notes covered. */
  attachments?: Attachment[];
}

// assigned: given to the student, not yet turned in.
// submitted: the student marked it done — awaiting the tutor's review.
// done: the tutor has reviewed and confirmed it.
export type HomeworkStatus = "assigned" | "submitted" | "done";

export interface Attachment {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface Homework {
  id: string;
  studentId: string;
  studentName: string;
  title: string;
  due: string | null;
  status: HomeworkStatus;
  noteId?: string;
  lessonId?: string;
  attachments?: Attachment[];
  /** Files the student attached when submitting — e.g. photos of completed work. */
  submissionAttachments?: Attachment[];
  /** Tutor's feedback on the reviewed work — visible to the student too. */
  reviewComment?: string;
  /** Grade on the Russian 2-5 school scale — visible to the student too. */
  grade?: number;
}

export interface ChatMessage {
  id: string;
  from: "me" | "student";
  text: string;
  at: number;
  attachments?: Attachment[];
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

export type MethodNoteTabKey = "theory" | "rules" | "tasks" | "test" | "homework";

export type MethodNoteTabs = Record<MethodNoteTabKey, string>;

export type MethodNoteAttachments = Partial<Record<MethodNoteTabKey, Attachment[]>>;

export interface MethodNote {
  id: string;
  topic: string;
  grade: string;
  subject: string;
  /** @deprecated legacy flat notes; new notes use `tabs` instead */
  content?: string;
  tabs?: MethodNoteTabs;
  attachments?: MethodNoteAttachments;
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
  | "schedule"
  | "messages"
  | "homework"
  | "tasks"
  | "notes"
  | "stats";
