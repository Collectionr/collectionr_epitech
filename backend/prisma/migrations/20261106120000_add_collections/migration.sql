-- CreateEnum
CREATE TYPE "CardCondition" AS ENUM ('NM', 'LP', 'MP', 'HP', 'DMG');

-- CreateEnum
CREATE TYPE "CardLanguage" AS ENUM ('fr', 'en');

-- CreateTable
CREATE TABLE "collections" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "licenceTCGId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_entries" (
    "id" UUID NOT NULL,
    "collectionId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "variantId" UUID,
    "gradingResultId" UUID,
    "quantity" INTEGER NOT NULL,
    "condition" "CardCondition" NOT NULL,
    "language" "CardLanguage" NOT NULL,
    "gradingNote" DECIMAL(3,1),
    "notes" TEXT,
    "addedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collections_userId_createdAt_id_idx" ON "collections"("userId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "collections_licenceTCGId_idx" ON "collections"("licenceTCGId");

-- CreateIndex
CREATE INDEX "card_entries_collectionId_addedAt_id_idx" ON "card_entries"("collectionId", "addedAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "card_entries_cardId_idx" ON "card_entries"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "variants_cardId_id_key" ON "variants"("cardId", "id");

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_licenceTCGId_fkey" FOREIGN KEY ("licenceTCGId") REFERENCES "licences_tcg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_entries" ADD CONSTRAINT "card_entries_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_entries" ADD CONSTRAINT "card_entries_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_entries" ADD CONSTRAINT "card_entries_cardId_variantId_fkey" FOREIGN KEY ("cardId", "variantId") REFERENCES "variants"("cardId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Defence in depth: the domain validates these first (CardEntry, ADR-017), the store refuses what
-- should never be written by anything else (an import, a script). Only the bounds that cannot change
-- with a product decision are repeated here; the upper bounds of quantity and notes stay in the domain.
ALTER TABLE "card_entries" ADD CONSTRAINT "card_entries_quantity_positive" CHECK ("quantity" >= 1);
ALTER TABLE "card_entries" ADD CONSTRAINT "card_entries_gradingNote_scale" CHECK ("gradingNote" IS NULL OR ("gradingNote" >= 0 AND "gradingNote" <= 10));
