/**
 * Standardized API Response Handler
 * Ensures consistent response format across all endpoints
 */

const success = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = {
    success: true,
    message,
    data
  };
  
  return res.status(statusCode).json(response);
};

const created = (res, data = null, message = 'Created successfully') => {
  return success(res, data, message, 201);
};

const error = (res, message = 'An error occurred', statusCode = 400, errors = null) => {
  const response = {
    success: false,
    message,
    errors
  };
  
  return res.status(statusCode).json(response);
};

const notFound = (res, message = 'Resource not found') => {
  return error(res, message, 404);
};

const unauthorized = (res, message = 'Unauthorized access') => {
  return error(res, message, 401);
};

const forbidden = (res, message = 'Access forbidden') => {
  return error(res, message, 403);
};

const validationError = (res, errors, message = 'Validation failed') => {
  return error(res, message, 422, errors);
};

const serverError = (res, message = 'Internal server error', err = null) => {
  if (process.env.NODE_ENV === 'development' && err) {
    console.error('Server Error:', err);
  }
  return error(res, message, 500);
};

const paginated = (res, data, pagination, message = 'Success') => {
  const response = {
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
      hasMore: pagination.page < Math.ceil(pagination.total / pagination.limit)
    }
  };
  
  return res.status(200).json(response);
};

module.exports = {
  success,
  created,
  error,
  notFound,
  unauthorized,
  forbidden,
  validationError,
  serverError,
  paginated
};
