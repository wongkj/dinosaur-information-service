import {
  decimal,
  index,
  int,
  mysqlTable,
  varchar,
} from "drizzle-orm/mysql-core";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const dinoData = mysqlTable(
  "dino_data",
  {
    occurrenceNo: int("occurrence_no").primaryKey(),
    recordType: varchar("record_type", { length: 32 }).notNull(),
    reidNo: int("reid_no"),
    flags: varchar("flags", { length: 255 }),
    collectionNo: int("collection_no").notNull(),
    identifiedName: varchar("identified_name", { length: 255 }).notNull(),
    identifiedRank: varchar("identified_rank", { length: 64 }),
    identifiedNo: int("identified_no"),
    difference: varchar("difference", { length: 255 }),
    acceptedName: varchar("accepted_name", { length: 255 }).notNull(),
    acceptedRank: varchar("accepted_rank", { length: 64 }),
    acceptedNo: int("accepted_no"),
    earlyInterval: varchar("early_interval", { length: 128 }),
    lateInterval: varchar("late_interval", { length: 128 }),
    maxMa: decimal("max_ma", { precision: 7, scale: 3 }),
    minMa: decimal("min_ma", { precision: 7, scale: 3 }),
    referenceNo: int("reference_no").notNull(),
  },
  (table) => [
    index("dino_data_collection_no_idx").on(table.collectionNo),
    index("dino_data_accepted_no_idx").on(table.acceptedNo),
    index("dino_data_reference_no_idx").on(table.referenceNo),
    index("dino_data_identification_idx").on(
      table.identifiedName,
      table.acceptedName,
    ),
  ],
);

export type InsertDinoData = InferInsertModel<typeof dinoData>;
export type SelectDinoData = InferSelectModel<typeof dinoData>;
