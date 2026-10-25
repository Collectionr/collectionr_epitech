-- CreateTable
CREATE TABLE "licences_tcg" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "licences_tcg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "licenceTCGId" UUID NOT NULL,
    "tcgdexId" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameFr" TEXT,
    "serieTcgdexId" TEXT,
    "serieNameEn" TEXT,
    "serieNameFr" TEXT,
    "releaseDate" DATE,
    "abbreviationOfficial" TEXT,
    "abbreviationFr" TEXT,
    "tcgOnlineCode" TEXT,
    "officialCardCount" INTEGER NOT NULL,
    "totalCardCount" INTEGER NOT NULL,
    "normalCardCount" INTEGER,
    "reverseCardCount" INTEGER,
    "holoCardCount" INTEGER,
    "firstEditionCardCount" INTEGER,
    "logoUrlEn" TEXT,
    "logoUrlFr" TEXT,
    "symbolUrl" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "setId" UUID NOT NULL,
    "tcgdexId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameFr" TEXT,
    "categoryEn" TEXT NOT NULL,
    "categoryFr" TEXT,
    "rarityEn" TEXT,
    "rarityFr" TEXT,
    "illustrator" TEXT,
    "hp" INTEGER,
    "typesEn" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "typesFr" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dexIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "evolveFromEn" TEXT,
    "evolveFromFr" TEXT,
    "stageEn" TEXT,
    "stageFr" TEXT,
    "suffix" TEXT,
    "trainerTypeEn" TEXT,
    "trainerTypeFr" TEXT,
    "energyTypeEn" TEXT,
    "energyTypeFr" TEXT,
    "tcgdexUpdatedAt" TIMESTAMPTZ(6),
    "imageUrlEn" TEXT,
    "imageUrlFr" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cardId" UUID NOT NULL,
    "tcgdexVariantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "size" TEXT NOT NULL,
    "stamps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "foil" TEXT,
    "cardmarketProductId" INTEGER,
    "tcgplayerProductId" INTEGER,
    "cardtraderProductId" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "licences_tcg_slug_key" ON "licences_tcg"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "sets_tcgdexId_key" ON "sets"("tcgdexId");

-- CreateIndex
CREATE INDEX "sets_licenceTCGId_idx" ON "sets"("licenceTCGId");

-- CreateIndex
CREATE UNIQUE INDEX "cards_tcgdexId_key" ON "cards"("tcgdexId");

-- CreateIndex
CREATE INDEX "cards_setId_idx" ON "cards"("setId");

-- CreateIndex
CREATE UNIQUE INDEX "variants_cardId_tcgdexVariantId_key" ON "variants"("cardId", "tcgdexVariantId");

-- AddForeignKey
ALTER TABLE "sets" ADD CONSTRAINT "sets_licenceTCGId_fkey" FOREIGN KEY ("licenceTCGId") REFERENCES "licences_tcg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_setId_fkey" FOREIGN KEY ("setId") REFERENCES "sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

