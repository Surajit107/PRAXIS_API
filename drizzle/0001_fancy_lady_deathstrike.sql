CREATE TABLE "public_json_docs" (
	"collection" text NOT NULL,
	"doc_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "public_json_docs_collection_doc_id_pk" PRIMARY KEY("collection","doc_id")
);
--> statement-breakpoint
CREATE INDEX "public_json_docs_collection_idx" ON "public_json_docs" USING btree ("collection");