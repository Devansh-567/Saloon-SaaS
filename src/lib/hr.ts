export const ATTENDANCE_STATUSES = ["PRESENT", "HALF_DAY", "ABSENT", "LEAVE", "HOLIDAY", "WEEK_OFF"] as const;
export type AttendanceStatusValue = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatusValue, string> = {
  PRESENT: "Present",
  HALF_DAY: "Half day",
  ABSENT: "Absent",
  LEAVE: "On leave",
  HOLIDAY: "Holiday",
  WEEK_OFF: "Week off",
};

export const LEAVE_TYPES = ["CASUAL", "SICK", "UNPAID", "OTHER"] as const;
export type LeaveTypeValue = (typeof LEAVE_TYPES)[number];

export const LEAVE_TYPE_LABELS: Record<LeaveTypeValue, string> = {
  CASUAL: "Casual leave",
  SICK: "Sick leave",
  UNPAID: "Unpaid leave",
  OTHER: "Other",
};

export const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type LeaveStatusValue = (typeof LEAVE_STATUSES)[number];

export const LEAVE_STATUS_LABELS: Record<LeaveStatusValue, string> = {
  PENDING: "Waiting",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export const ADVANCE_STATUSES = ["PENDING", "APPROVED", "PAID", "REJECTED"] as const;
export type AdvanceStatusValue = (typeof ADVANCE_STATUSES)[number];

export const ADVANCE_STATUS_LABELS: Record<AdvanceStatusValue, string> = {
  PENDING: "Waiting",
  APPROVED: "Approved",
  PAID: "Paid",
  REJECTED: "Rejected",
};

export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY"] as const;
export type EmploymentTypeValue = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentTypeValue, string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  CONTRACT: "Contract",
  TEMPORARY: "Temporary",
};

export const DOCUMENT_KINDS = ["AADHAAR", "PAN", "PHOTO", "CONTRACT", "OTHER"] as const;
export type DocumentKindValue = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_KIND_LABELS: Record<DocumentKindValue, string> = {
  AADHAAR: "Aadhaar",
  PAN: "PAN card",
  PHOTO: "Photo",
  CONTRACT: "Contract",
  OTHER: "Other",
};

export const PAYMENT_METHODS = ["CASH", "CARD", "UPI", "BANK", "OTHER"] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodValue, string> = {
  CASH: "Cash",
  CARD: "Card",
  UPI: "UPI",
  BANK: "Bank transfer",
  OTHER: "Other",
};

export function attendanceTone(status: AttendanceStatusValue | null) {
  if (!status) return "badge-muted";
  if (status === "PRESENT") return "badge-success";
  if (status === "HALF_DAY") return "badge-warning";
  if (status === "LEAVE" || status === "HOLIDAY" || status === "WEEK_OFF") return "badge-info";
  return "badge-danger";
}

export function leaveTone(status: string) {
  if (status === "APPROVED") return "badge-success";
  if (status === "PENDING") return "badge-warning";
  if (status === "REJECTED") return "badge-danger";
  return "badge-muted";
}

export function advanceTone(status: string) {
  if (status === "PAID") return "badge-success";
  if (status === "APPROVED") return "badge-info";
  if (status === "PENDING") return "badge-warning";
  return "badge-danger";
}
