-- Correction : les profils de consommation de la graine 0010 etaient
-- des estimations inventees, pas des mesures. On les efface : l'UI
-- affiche "No data yet" tant qu'aucune mission reelle n'a ete mesuree.
-- Atlas est re-rempli par le backfill du sync (valeur mesuree N=4).
UPDATE "TalentProfile" SET "consumptionProfile" = NULL;
