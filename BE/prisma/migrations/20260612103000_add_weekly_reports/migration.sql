CREATE TYPE "WeeklyReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'NEEDS_REVISION');

CREATE TABLE "WeeklyReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "status" "WeeklyReportStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WeeklyReportRow" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "customer" TEXT,
    "machine" TEXT,
    "content" TEXT NOT NULL,
    "result" TEXT,
    "pending" TEXT,
    "proposal" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReportRow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeeklyReport_userId_weekStart_key" ON "WeeklyReport"("userId", "weekStart");
CREATE INDEX "WeeklyReport_weekStart_idx" ON "WeeklyReport"("weekStart");
CREATE INDEX "WeeklyReport_status_idx" ON "WeeklyReport"("status");
CREATE INDEX "WeeklyReport_reviewerId_idx" ON "WeeklyReport"("reviewerId");
CREATE INDEX "WeeklyReportRow_reportId_sortOrder_idx" ON "WeeklyReportRow"("reportId", "sortOrder");
CREATE INDEX "WeeklyReportRow_workDate_idx" ON "WeeklyReportRow"("workDate");

ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WeeklyReportRow" ADD CONSTRAINT "WeeklyReportRow_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "WeeklyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
