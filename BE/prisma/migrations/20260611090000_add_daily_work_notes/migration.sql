CREATE TABLE "DailyWorkNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "workDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyWorkNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DailyWorkNote_userId_workDate_idx" ON "DailyWorkNote"("userId", "workDate");

ALTER TABLE "DailyWorkNote" ADD CONSTRAINT "DailyWorkNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
