export function totalOpenWorkCount(counts: {
  repairs: number;
  maintenances: number;
  installations: number;
  demoLoans: number;
  deviceServiceTickets: number;
}) {
  return counts.repairs + counts.maintenances + counts.installations + counts.demoLoans + counts.deviceServiceTickets;
}
