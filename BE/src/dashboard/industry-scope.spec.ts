import { buildBusinessLineIndustryScope } from './industry-scope';

describe('buildBusinessLineIndustryScope', () => {
  it('applies selected industry and engineer expertise as intersecting filters', () => {
    expect(buildBusinessLineIndustryScope('industry-1', 'IMAGING')).toEqual({
      productIndustryId: 'industry-1',
      productIndustry: { expertiseGroup: { in: ['IMAGING'] } },
    });
  });

  it('includes both configured engineer expertise groups', () => {
    expect(buildBusinessLineIndustryScope(undefined, ['IMAGING', 'LAB_TESTING'])).toEqual({
      productIndustry: { expertiseGroup: { in: ['IMAGING', 'LAB_TESTING'] } },
    });
  });

  it('returns no restriction when neither filter is selected', () => {
    expect(buildBusinessLineIndustryScope()).toEqual({});
  });
});
