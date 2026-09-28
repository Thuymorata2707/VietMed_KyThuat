import { ExpertiseGroup, Prisma } from '@prisma/client';

export function buildBusinessLineIndustryScope(
  productIndustryId?: string,
  engineerExpertiseGroups?: ExpertiseGroup[] | ExpertiseGroup | null,
): Prisma.BusinessLineWhereInput {
  const groups = Array.isArray(engineerExpertiseGroups)
    ? engineerExpertiseGroups
    : engineerExpertiseGroups ? [engineerExpertiseGroups] : [];
  return {
    ...(productIndustryId ? { productIndustryId } : {}),
    ...(groups.length
      ? { productIndustry: { expertiseGroup: { in: groups } } }
      : {}),
  };
}
