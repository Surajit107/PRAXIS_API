import fs from "fs";
import logger from "@/logger/winston.logger.js";

/**
 *
 * @param {string[]} fieldsArray
 * @param {any[]} objectArray
 * @returns {any[]}
 * @description utility function to only include fields present in the fieldsArray
 * For example,
 * ```js
 * let fieldsArray = [
 * {
 * id:1,
 * name:"John Doe",
 * email:"john@doe.com"
 * phone: "123456"
 * },
 * {
 * id:2,
 * name:"Mark H",
 * email:"mark@h.com"
 * phone: "563526"
 * }
 * ]
 * let fieldsArray = ["name", "email"]
 * 
 * const filteredKeysObject = filterObjectKeys(fieldsArray, fieldsArray)
 * console.log(filteredKeysObject) 
 * 
//  Above line's output will be:
//  [
//      {
//        name:"John Doe",
//        email:"john@doe.com"
//      },
//      {
//        name:"Mark H",
//        email:"mark@h.com"
//      }
//  ]
 * 
 * ```
 */
export const filterObjectKeys = (fieldsArray, objectArray) => {
  const filteredArray = structuredClone(objectArray).map((originalObj) => {
    let obj = {};
    structuredClone(fieldsArray)?.forEach((field) => {
      if (field?.trim() in originalObj) {
        obj[field] = originalObj[field];
      }
    });
    if (Object.keys(obj).length > 0) return obj;
    return originalObj;
  });
  return filteredArray;
};

/**
 *
 * @param {any[]} dataArray
 * @param {number} page
 * @param {number} limit
 * @returns {{previousPage: string | null, currentPage: string, nextPage: string | null, data: any[]}}
 */
export const getPaginatedPayload = (dataArray, page, limit) => {
  const startPosition = +(page - 1) * limit;

  const totalItems = dataArray.length; // total documents present after applying search query
  const totalPages = Math.ceil(totalItems / limit);

  dataArray = structuredClone(dataArray).slice(
    startPosition,
    startPosition + limit
  );

  const payload = {
    page,
    limit,
    totalPages,
    previousPage: page > 1,
    nextPage: page < totalPages,
    totalItems,
    currentPageItems: dataArray?.length,
    data: dataArray,
  };
  return payload;
};

/**
 *
 * @param {import("express").Request} req
 * @param {string} fileName
 * @description returns the file's static path from where the server is serving the static image
 */
export const getStaticFilePath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/images/${fileName}`;
};

/**
 *
 * @param {string} fileName
 * @description returns the file's local path in the file system to assist future removal
 */
export const getLocalPath = (fileName) => {
  return `public/images/${fileName}`;
};

/**
 *
 * @param {string} localPath
 * @description Removed the local file from the local file system based on the file path
 */
export const removeLocalFile = (localPath) => {
  fs.unlink(localPath, (err) => {
    if (err) logger.error("Error while removing local files: ", err);
    else {
      logger.info("Removed local: ", localPath);
    }
  });
};

/**
 * @param {import("express").Request} req
 * @description **This utility function is responsible for removing unused image files due to the api fail**.
 *
 * **For example:**
 * * This can occur when product is created.
 * * In product creation process the images are getting uploaded before product gets created.
 * * Once images are uploaded and if there is an error creating a product, the uploaded images are unused.
 * * In such case, this function will remove those unused images.
 */
export const removeUnusedMulterImageFilesOnError = (req) => {
  try {
    const multerFile = req.file;
    const multerFiles = req.files;

    if (multerFile) {
      // If there is file uploaded and there is validation error
      // We want to remove that file
      removeLocalFile(multerFile.path);
    }

    if (multerFiles) {
      /** @type {Express.Multer.File[][]}  */
      const filesValueArray = Object.values(multerFiles);
      // If there are multiple files uploaded for more than one fields
      // We want to remove those files as well
      filesValueArray.map((fileFields) => {
        fileFields.map((fileObject) => {
          removeLocalFile(fileObject.path);
        });
      });
    }
  } catch (error) {
    // fail silently
    logger.error("Error while removing image files: ", error);
  }
};

/**
 * Normalized page/limit + customLabels defaults for paginated list responses.
 * Always remaps `pagingCounter` → `serialNumberStartFrom` unless overridden.
 *
 * @param {{page?: number; limit?: number; customLabels?: Record<string, string>}} options
 */
export const getDrizzlePaginationOptions = ({
  page = 1,
  limit = 10,
  customLabels,
}) => {
  return {
    page: Math.max(Number(page) || 1, 1),
    limit: Math.max(Number(limit) || 1, 1),
    pagination: true,
    customLabels: {
      pagingCounter: "serialNumberStartFrom",
      ...customLabels,
    },
  };
};

const DEFAULT_PAGINATE_LABELS = {
  docs: "docs",
  totalDocs: "totalDocs",
  limit: "limit",
  page: "page",
  totalPages: "totalPages",
  pagingCounter: "pagingCounter",
  hasPrevPage: "hasPrevPage",
  hasNextPage: "hasNextPage",
  prevPage: "prevPage",
  nextPage: "nextPage",
};

/**
 * Standard `aggregatePaginate` response shape (page/limit + customLabels).
 * Pass already-fetched page docs + total count; applies `customLabels` key renames.
 *
 * @param {{
 *   docs: unknown[];
 *   totalDocs: number;
 *   page?: number;
 *   limit?: number;
 *   customLabels?: Record<string, string>;
 * }} params
 * @returns {Record<string, unknown>}
 */
export const buildAggregatePaginateResponse = ({
  docs,
  totalDocs,
  page = 1,
  limit = 10,
  customLabels = {},
}) => {
  const normalizedPage = Math.max(Number(page) || 1, 1);
  const normalizedLimit = Math.max(Number(limit) || 1, 1);
  const total = Math.max(Number(totalDocs) || 0, 0);
  // Math.ceil(totalDocs / limit) || 1
  const totalPages = Math.ceil(total / normalizedLimit) || 1;
  const hasPrevPage = normalizedPage > 1;
  const hasNextPage = normalizedPage < totalPages;
  const pagingCounter = (normalizedPage - 1) * normalizedLimit + 1;

  const labels = {
    ...DEFAULT_PAGINATE_LABELS,
    ...customLabels,
  };

  return {
    [labels.docs]: docs,
    [labels.totalDocs]: total,
    [labels.limit]: normalizedLimit,
    [labels.page]: normalizedPage,
    [labels.totalPages]: totalPages,
    [labels.pagingCounter]: pagingCounter,
    [labels.hasPrevPage]: hasPrevPage,
    [labels.hasNextPage]: hasNextPage,
    [labels.prevPage]: hasPrevPage ? normalizedPage - 1 : null,
    [labels.nextPage]: hasNextPage ? normalizedPage + 1 : null,
  };
};

/**
 * Drizzle pagination wrapper producing the standard `aggregatePaginate` response.
 * Controllers supply count + page-fetch callbacks; returns labeled payload.
 *
 * @param {{
 *   page?: number;
 *   limit?: number;
 *   customLabels?: Record<string, string>;
 *   getTotalDocs: () => Promise<number>;
 *   getDocs: (args: { limit: number; offset: number; page: number }) => Promise<unknown[]>;
 * }} params
 */
export const aggregatePaginate = async ({
  page = 1,
  limit = 10,
  customLabels,
  getTotalDocs,
  getDocs,
}) => {
  const options = getDrizzlePaginationOptions({ page, limit, customLabels });
  const offset = (options.page - 1) * options.limit;

  const [totalDocs, docs] = await Promise.all([
    getTotalDocs(),
    getDocs({
      limit: options.limit,
      offset,
      page: options.page,
    }),
  ]);

  return buildAggregatePaginateResponse({
    docs,
    totalDocs,
    page: options.page,
    limit: options.limit,
    customLabels: options.customLabels,
  });
};

/**
 * @param {number} max Ceil threshold (exclusive)
 */
export const getRandomNumber = (max) => {
  return Math.floor(Math.random() * max);
};
