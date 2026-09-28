export type RequestUser = {
  id: string;
  email: string;
  roleId: string;
  roleName: string;
  regionId: string;
  expertiseGroup?: string | null;
  expertiseGroups?: string[];
};
