import { body, param } from "express-validator";

/**
 * Path-param ID validator (UUID PKs).
 * Export name kept as `mongoIdPathVariableValidator` for route compatibility.
 *
 * @param {string} idName
 */
export const mongoIdPathVariableValidator = (idName) => {
  return [
    param(idName)
      .notEmpty()
      .isUUID()
      .withMessage(`Invalid ${idName}`),
  ];
};

/**
 * Request-body ID validator (UUID PKs).
 * Export name kept as `mongoIdRequestBodyValidator` for route compatibility.
 *
 * @param {string} idName
 */
export const mongoIdRequestBodyValidator = (idName) => {
  return [
    body(idName)
      .notEmpty()
      .isUUID()
      .withMessage(`Invalid ${idName}`),
  ];
};
