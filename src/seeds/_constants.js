/** Jest shrinks volumes so Neon/pooler + bcrypt seedUsers stay practical. */
const isJest = typeof process.env.JEST_WORKER_ID !== "undefined";

// * TODOS
export const TODOS_COUNT = 20;

// * USERS
export const USERS_COUNT = isJest ? 8 : 50;

// * ECOMMERCE
export const CATEGORIES_COUNT = isJest ? 5 : 25;
export const ADDRESSES_COUNT = isJest ? 8 : 100;
export const COUPONS_COUNT = isJest ? 4 : 15;
export const PRODUCTS_COUNT = isJest ? 8 : 50;
export const PRODUCTS_SUB_IMAGES_COUNT = isJest ? 2 : 4;
export const ORDERS_COUNT = isJest ? 4 : 20;
export const ORDERS_RANDOM_ITEMS_COUNT = isJest ? 4 : 20;

// * SOCIAL MEDIA
export const SOCIAL_POSTS_COUNT = 200;
export const SOCIAL_POST_IMAGES_COUNT = 6;
export const SOCIAL_LIKES_COUNT = 2000;
export const SOCIAL_FOLLOWS_COUNT = 1000;
export const SOCIAL_COMMENTS_COUNT = 500;
export const SOCIAL_BOOKMARKS_COUNT = 200;

// * CHAT APP
export const ONE_ON_ONE_CHATS_COUNT = 100;
export const GROUP_CHATS_COUNT = 30;
export const GROUP_CHAT_MAX_PARTICIPANTS_COUNT = 10;
