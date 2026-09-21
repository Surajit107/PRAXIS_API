CREATE TYPE "public"."coupon_type" AS ENUM('FLAT');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PENDING', 'CANCELLED', 'DELIVERED');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('UNKNOWN', 'RAZORPAY', 'PAYPAL');--> statement-breakpoint
CREATE TYPE "public"."user_login_type" AS ENUM('GOOGLE', 'GITHUB', 'EMAIL_PASSWORD');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'USER');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"avatar_url" text DEFAULT 'https://via.placeholder.com/200x200.png' NOT NULL,
	"avatar_local_path" text DEFAULT '' NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'USER' NOT NULL,
	"password" text NOT NULL,
	"login_type" "user_login_type" DEFAULT 'EMAIL_PASSWORD' NOT NULL,
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"refresh_token" text,
	"forgot_password_token" text,
	"forgot_password_expiry" timestamp with time zone,
	"email_verification_token" text,
	"email_verification_expiry" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "todos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" uuid NOT NULL,
	"description" text NOT NULL,
	"main_image_url" text NOT NULL,
	"main_image_local_path" text DEFAULT '' NOT NULL,
	"name" text NOT NULL,
	"owner" uuid,
	"price" double precision DEFAULT 0 NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_sub_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"local_path" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address_line_1" text NOT NULL,
	"address_line_2" text,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"owner" uuid,
	"pincode" text NOT NULL,
	"state" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"coupon_code" text NOT NULL,
	"type" "coupon_type" DEFAULT 'FLAT' NOT NULL,
	"discount_value" double precision NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"minimum_cart_value" double precision DEFAULT 0 NOT NULL,
	"start_date" timestamp with time zone DEFAULT now() NOT NULL,
	"expiry_date" timestamp with time zone,
	"owner" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner" uuid,
	"coupon" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ecom_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_price" double precision NOT NULL,
	"discounted_order_price" double precision NOT NULL,
	"coupon" uuid,
	"customer" uuid,
	"address_line_1" text NOT NULL,
	"address_line_2" text,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"pincode" text NOT NULL,
	"state" text NOT NULL,
	"status" "order_status" DEFAULT 'PENDING' NOT NULL,
	"payment_provider" "payment_provider" DEFAULT 'UNKNOWN' NOT NULL,
	"payment_id" text,
	"is_payment_done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ecom_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ecom_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text DEFAULT 'John' NOT NULL,
	"last_name" text DEFAULT 'Doe' NOT NULL,
	"country_code" text DEFAULT '' NOT NULL,
	"phone_number" text DEFAULT '' NOT NULL,
	"owner" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cover_image_url" text DEFAULT 'https://via.placeholder.com/800x450.png' NOT NULL,
	"cover_image_local_path" text DEFAULT '' NOT NULL,
	"first_name" text DEFAULT 'John' NOT NULL,
	"last_name" text DEFAULT 'Doe' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"dob" timestamp with time zone,
	"location" text DEFAULT '' NOT NULL,
	"country_code" text DEFAULT '' NOT NULL,
	"phone_number" text DEFAULT '' NOT NULL,
	"owner" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"author" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_post_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"url" text NOT NULL,
	"local_path" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"post_id" uuid,
	"author" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid,
	"comment_id" uuid,
	"liked_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" uuid,
	"followee_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid,
	"bookmarked_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_group_chat" boolean DEFAULT false NOT NULL,
	"last_message" uuid,
	"admin" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_participants" (
	"chat_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_participants_chat_id_user_id_pk" PRIMARY KEY("chat_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender" uuid,
	"content" text,
	"chat" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_message_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"url" text NOT NULL,
	"local_path" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_owner_users_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_categories_id_fk" FOREIGN KEY ("category") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_owner_users_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_sub_images" ADD CONSTRAINT "product_sub_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_owner_users_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_owner_users_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_owner_users_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_coupon_coupons_id_fk" FOREIGN KEY ("coupon") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ecom_orders" ADD CONSTRAINT "ecom_orders_coupon_coupons_id_fk" FOREIGN KEY ("coupon") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ecom_orders" ADD CONSTRAINT "ecom_orders_customer_users_id_fk" FOREIGN KEY ("customer") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ecom_order_items" ADD CONSTRAINT "ecom_order_items_order_id_ecom_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."ecom_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ecom_order_items" ADD CONSTRAINT "ecom_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ecom_profiles" ADD CONSTRAINT "ecom_profiles_owner_users_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_profiles" ADD CONSTRAINT "social_profiles_owner_users_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_author_users_id_fk" FOREIGN KEY ("author") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_post_images" ADD CONSTRAINT "social_post_images_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_comments" ADD CONSTRAINT "social_comments_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_comments" ADD CONSTRAINT "social_comments_author_users_id_fk" FOREIGN KEY ("author") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_likes" ADD CONSTRAINT "social_likes_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_likes" ADD CONSTRAINT "social_likes_comment_id_social_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."social_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_likes" ADD CONSTRAINT "social_likes_liked_by_users_id_fk" FOREIGN KEY ("liked_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_follows" ADD CONSTRAINT "social_follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_follows" ADD CONSTRAINT "social_follows_followee_id_users_id_fk" FOREIGN KEY ("followee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_bookmarks" ADD CONSTRAINT "social_bookmarks_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_bookmarks" ADD CONSTRAINT "social_bookmarks_bookmarked_by_users_id_fk" FOREIGN KEY ("bookmarked_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_admin_users_id_fk" FOREIGN KEY ("admin") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_users_id_fk" FOREIGN KEY ("sender") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chat_chats_id_fk" FOREIGN KEY ("chat") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_attachments" ADD CONSTRAINT "chat_message_attachments_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uidx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uidx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "todos_title_idx" ON "todos" USING btree ("title");--> statement-breakpoint
CREATE INDEX "categories_owner_idx" ON "categories" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "products_owner_idx" ON "products" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "product_sub_images_product_idx" ON "product_sub_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "addresses_owner_idx" ON "addresses" USING btree ("owner");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_coupon_code_uidx" ON "coupons" USING btree ("coupon_code");--> statement-breakpoint
CREATE INDEX "coupons_owner_idx" ON "coupons" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "carts_owner_idx" ON "carts" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "cart_items_cart_idx" ON "cart_items" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "cart_items_product_idx" ON "cart_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "ecom_orders_customer_idx" ON "ecom_orders" USING btree ("customer");--> statement-breakpoint
CREATE INDEX "ecom_orders_status_idx" ON "ecom_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ecom_order_items_order_idx" ON "ecom_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "ecom_order_items_product_idx" ON "ecom_order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "ecom_profiles_owner_idx" ON "ecom_profiles" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "social_profiles_owner_idx" ON "social_profiles" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "social_posts_content_idx" ON "social_posts" USING btree ("content");--> statement-breakpoint
CREATE INDEX "social_posts_author_idx" ON "social_posts" USING btree ("author");--> statement-breakpoint
CREATE INDEX "social_post_images_post_idx" ON "social_post_images" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "social_comments_post_idx" ON "social_comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "social_comments_author_idx" ON "social_comments" USING btree ("author");--> statement-breakpoint
CREATE INDEX "social_likes_post_idx" ON "social_likes" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "social_likes_comment_idx" ON "social_likes" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "social_likes_liked_by_idx" ON "social_likes" USING btree ("liked_by");--> statement-breakpoint
CREATE INDEX "social_follows_follower_idx" ON "social_follows" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "social_follows_followee_idx" ON "social_follows" USING btree ("followee_id");--> statement-breakpoint
CREATE INDEX "social_bookmarks_post_idx" ON "social_bookmarks" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "social_bookmarks_bookmarked_by_idx" ON "social_bookmarks" USING btree ("bookmarked_by");--> statement-breakpoint
CREATE INDEX "chats_admin_idx" ON "chats" USING btree ("admin");--> statement-breakpoint
CREATE INDEX "chat_participants_user_idx" ON "chat_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_messages_chat_idx" ON "chat_messages" USING btree ("chat");--> statement-breakpoint
CREATE INDEX "chat_messages_sender_idx" ON "chat_messages" USING btree ("sender");--> statement-breakpoint
CREATE INDEX "chat_message_attachments_message_idx" ON "chat_message_attachments" USING btree ("message_id");