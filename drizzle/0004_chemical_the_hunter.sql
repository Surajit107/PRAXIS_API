CREATE TABLE "geo_cities" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"state_id" integer NOT NULL,
	"country_id" integer NOT NULL,
	"country_code" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision
);
--> statement-breakpoint
CREATE TABLE "geo_countries" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"iso2" text NOT NULL,
	"iso3" text,
	"phonecode" text,
	"capital" text,
	"currency" text,
	"native" text,
	"emoji" text,
	"latitude" double precision,
	"longitude" double precision
);
--> statement-breakpoint
CREATE TABLE "geo_states" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"country_id" integer NOT NULL,
	"country_code" text NOT NULL,
	"state_code" text,
	"type" text,
	"latitude" double precision,
	"longitude" double precision
);
--> statement-breakpoint
ALTER TABLE "geo_cities" ADD CONSTRAINT "geo_cities_state_id_geo_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."geo_states"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_cities" ADD CONSTRAINT "geo_cities_country_id_geo_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."geo_countries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_states" ADD CONSTRAINT "geo_states_country_id_geo_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."geo_countries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "geo_cities_state_id_idx" ON "geo_cities" USING btree ("state_id");--> statement-breakpoint
CREATE INDEX "geo_cities_state_id_name_idx" ON "geo_cities" USING btree ("state_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "geo_countries_iso2_uidx" ON "geo_countries" USING btree ("iso2");--> statement-breakpoint
CREATE INDEX "geo_countries_name_idx" ON "geo_countries" USING btree ("name");--> statement-breakpoint
CREATE INDEX "geo_states_country_code_idx" ON "geo_states" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "geo_states_country_code_name_idx" ON "geo_states" USING btree ("country_code","name");