export class UpsertEngineerProfileDto {
  employeeCode?: string | null;
  dateOfBirth?: string | null;
  position?: string | null;
  department?: string | null;
  workStartDate?: string | null;
  specialties?: string[];
  certificateNo?: string | null;
  note?: string | null;
}
