const { createHttpError } = require('./errorMiddleware');

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const validate = (schema = {}) => (req, res, next) => {
  try {
    ['body', 'params', 'query'].forEach((target) => {
      const rules = schema[target];
      if (!Array.isArray(rules) || rules.length === 0) return;

      const source = isPlainObject(req[target]) ? { ...req[target] } : {};
      rules.forEach((rule) => rule(source, req));
      req[target] = source;
    });

    next();
  } catch (error) {
    next(error);
  }
};

const ensurePresent = (container, field, label) => {
  if (container[field] === undefined || container[field] === null) {
    throw createHttpError(400, `${label || field} is required`);
  }
};

const stringField = (field, options = {}) => (container) => {
  const {
    required = false,
    allowEmpty = false,
    minLength,
    maxLength,
    label,
    enum: allowedValues,
    pattern
  } = options;

  if (required) ensurePresent(container, field, label);
  if (container[field] === undefined || container[field] === null) return;

  if (typeof container[field] !== 'string') {
    throw createHttpError(400, `${label || field} must be a string`);
  }

  container[field] = container[field].trim();

  if (!allowEmpty && container[field].length === 0) {
    throw createHttpError(400, `${label || field} cannot be empty`);
  }

  if (minLength && container[field].length < minLength) {
    throw createHttpError(400, `${label || field} must be at least ${minLength} characters`);
  }

  if (maxLength && container[field].length > maxLength) {
    throw createHttpError(400, `${label || field} must be at most ${maxLength} characters`);
  }

  if (allowedValues && !allowedValues.includes(container[field])) {
    throw createHttpError(400, `${label || field} must be one of: ${allowedValues.join(', ')}`);
  }

  if (pattern && !pattern.test(container[field])) {
    throw createHttpError(400, `${label || field} is invalid`);
  }
};

const emailField = (field, options = {}) => stringField(field, {
  ...options,
  pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  label: options.label || field
});

const numberField = (field, options = {}) => (container) => {
  const { required = false, min, max, integer = false, label } = options;

  if (required) ensurePresent(container, field, label);
  if (container[field] === undefined || container[field] === null || container[field] === '') return;

  const numericValue = Number(container[field]);
  if (!Number.isFinite(numericValue)) {
    throw createHttpError(400, `${label || field} must be a valid number`);
  }
  if (integer && !Number.isInteger(numericValue)) {
    throw createHttpError(400, `${label || field} must be an integer`);
  }
  if (min !== undefined && numericValue < min) {
    throw createHttpError(400, `${label || field} must be at least ${min}`);
  }
  if (max !== undefined && numericValue > max) {
    throw createHttpError(400, `${label || field} must be at most ${max}`);
  }

  container[field] = numericValue;
};

const booleanField = (field, options = {}) => (container) => {
  const { required = false, label } = options;

  if (required) ensurePresent(container, field, label);
  if (container[field] === undefined || container[field] === null || container[field] === '') return;

  if (typeof container[field] === 'boolean') return;
  if (container[field] === 'true') {
    container[field] = true;
    return;
  }
  if (container[field] === 'false') {
    container[field] = false;
    return;
  }

  throw createHttpError(400, `${label || field} must be a boolean`);
};

const arrayField = (field, options = {}) => (container) => {
  const { required = false, label, itemType = 'string' } = options;

  if (required) ensurePresent(container, field, label);
  if (container[field] === undefined || container[field] === null) return;

  if (!Array.isArray(container[field])) {
    throw createHttpError(400, `${label || field} must be an array`);
  }

  if (itemType === 'string') {
    container[field] = container[field].map((value) => {
      if (typeof value !== 'string') {
        throw createHttpError(400, `${label || field} must contain only strings`);
      }
      return value.trim();
    });
  }
};

const objectField = (field, options = {}) => (container) => {
  const { required = false, label } = options;

  if (required) ensurePresent(container, field, label);
  if (container[field] === undefined || container[field] === null) return;
  if (!isPlainObject(container[field])) {
    throw createHttpError(400, `${label || field} must be an object`);
  }
};

const idField = (field, options = {}) => stringField(field, {
  ...options,
  pattern: /^[a-fA-F0-9]{24}$/
});

module.exports = {
  validate,
  stringField,
  emailField,
  numberField,
  booleanField,
  arrayField,
  objectField,
  idField
};
