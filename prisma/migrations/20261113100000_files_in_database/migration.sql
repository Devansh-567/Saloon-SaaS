CREATE TABLE "StoredBlob" (
    "path" TEXT NOT NULL,
    "salonId" TEXT,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoredBlob_pkey" PRIMARY KEY ("path")
);

CREATE INDEX "StoredBlob_salonId_idx" ON "StoredBlob"("salonId");

ALTER TABLE "StoredBlob" ADD CONSTRAINT "StoredBlob_salonId_fkey"
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
