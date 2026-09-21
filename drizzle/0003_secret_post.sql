DROP INDEX "users_username_idx";--> statement-breakpoint
DROP INDEX "todos_title_idx";--> statement-breakpoint
DROP INDEX "carts_owner_idx";--> statement-breakpoint
DROP INDEX "cart_items_cart_idx";--> statement-breakpoint
DROP INDEX "ecom_profiles_owner_idx";--> statement-breakpoint
DROP INDEX "social_profiles_owner_idx";--> statement-breakpoint
DROP INDEX "social_posts_content_idx";--> statement-breakpoint
DROP INDEX "social_follows_follower_idx";--> statement-breakpoint
DROP INDEX "social_bookmarks_bookmarked_by_idx";--> statement-breakpoint
DROP INDEX "chat_messages_chat_idx";--> statement-breakpoint
DROP INDEX "public_json_docs_collection_idx";--> statement-breakpoint
CREATE INDEX "users_email_verification_token_idx" ON "users" USING btree ("email_verification_token");--> statement-breakpoint
CREATE INDEX "users_forgot_password_token_idx" ON "users" USING btree ("forgot_password_token");--> statement-breakpoint
CREATE INDEX "todos_updated_at_idx" ON "todos" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "carts_owner_uidx" ON "carts" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "carts_coupon_idx" ON "carts" USING btree ("coupon");--> statement-breakpoint
CREATE UNIQUE INDEX "cart_items_cart_product_uidx" ON "cart_items" USING btree ("cart_id","product_id");--> statement-breakpoint
CREATE INDEX "ecom_orders_payment_id_idx" ON "ecom_orders" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "ecom_orders_coupon_idx" ON "ecom_orders" USING btree ("coupon");--> statement-breakpoint
CREATE UNIQUE INDEX "ecom_profiles_owner_uidx" ON "ecom_profiles" USING btree ("owner");--> statement-breakpoint
CREATE UNIQUE INDEX "social_profiles_owner_uidx" ON "social_profiles" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "social_posts_tags_gin_idx" ON "social_posts" USING gin ("tags");--> statement-breakpoint
CREATE UNIQUE INDEX "social_likes_post_liked_by_uidx" ON "social_likes" USING btree ("post_id","liked_by") WHERE "social_likes"."post_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "social_likes_comment_liked_by_uidx" ON "social_likes" USING btree ("comment_id","liked_by") WHERE "social_likes"."comment_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "social_follows_follower_followee_uidx" ON "social_follows" USING btree ("follower_id","followee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "social_bookmarks_by_post_uidx" ON "social_bookmarks" USING btree ("bookmarked_by","post_id");--> statement-breakpoint
CREATE INDEX "chat_messages_chat_created_at_idx" ON "chat_messages" USING btree ("chat","created_at");