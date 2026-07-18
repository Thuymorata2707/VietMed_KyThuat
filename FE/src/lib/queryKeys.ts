export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  dashboard: {
    overview: ['dashboard', 'overview'] as const,
  },
  reports: {
    installations: (params: string) => ['reports', 'installations', params] as const,
    engineer: (engineerId: string, params: string) => ['reports', 'engineer', engineerId, params] as const,
    model: (modelKey: string, params: string) => ['reports', 'model', modelKey, params] as const,
  },
  notifications: {
    list: ['notifications', 'list'] as const,
  },
  knowledge: {
    articles: (params: string) => ['knowledge', 'articles', params] as const,
  },
  workAssignments: {
    dashboard: (params: string) => ['work-assignments', 'dashboard', params] as const,
  },
  adminUsers: {
    bootstrap: ['admin-users', 'bootstrap'] as const,
  },
  productCatalog: {
    overview: ['product-catalog', 'overview'] as const,
    modelDetail: (modelId: string) => ['product-catalog', 'model-detail', modelId] as const,
    machineDetail: (machineId: string) => ['product-catalog', 'machine-detail', machineId] as const,
    addProductModels: ['product-catalog', 'add-product-models'] as const,
  },
  regions: {
    list: ['regions', 'list'] as const,
    customers: (regionId: string) => ['regions', 'customers', regionId] as const,
    customerDetail: (customerId: string) => ['regions', 'customer-detail', customerId] as const,
  },
  roles: {
    list: ['roles', 'list'] as const,
  },
  resources: {
    list: (endpoint: string, params: string) => ['resources', endpoint, params] as const,
  },
  technicalStatistics: {
    overview: (params: string) => ['technical-statistics', params] as const,
  },
  dailyWork: {
    engineers: ['daily-work', 'engineers'] as const,
    notes: (params: string) => ['daily-work', 'notes', params] as const,
  },
  dailyReports: {
    engineers: ['daily-reports', 'engineers'] as const,
    report: (params: string) => ['daily-reports', 'report', params] as const,
  },
  weeklyReports: {
    engineers: ['weekly-reports', 'engineers'] as const,
    report: (params: string) => ['weekly-reports', 'report', params] as const,
    dailyRows: (params: string) => ['weekly-reports', 'daily-rows', params] as const,
    ticketRows: (params: string) => ['weekly-reports', 'ticket-rows', params] as const,
    applicationSupportRows: (params: string) => ['weekly-reports', 'application-support-rows', params] as const,
  },
  applicationSupport: {
    list: (params: string) => ['application-support', 'list', params] as const,
    options: ['application-support', 'options'] as const,
  },
  engineerPerformance: {
    engineers: ['engineer-performance', 'engineers'] as const,
    summary: (params: string) => ['engineer-performance', 'summary', params] as const,
  },
  serviceTickets: {
    engineers: ['service-tickets', 'engineers'] as const,
    industries: ['service-tickets', 'industries'] as const,
    board: (kind: string, params: string) => ['service-tickets', 'board', kind, params] as const,
    createOptions: ['service-tickets', 'create-options'] as const,
    machines: (kind: string) => ['service-tickets', 'machines', kind] as const,
  },
};
