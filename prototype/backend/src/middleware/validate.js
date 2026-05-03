/* ============================================================================
   Validation Middleware
   ----------------------------------------------------------------------------
   Wraps a Zod schema into Express middleware. Replaces the matched part
   of the request (body | query | params) with the parsed (typed) version.
   ========================================================================= */

const { ZodError } = require('zod');
const { ValidationError } = require('../utils/errors');

function validate(schema, target = 'body') {
  return (req, res, next) => {
    try {
      const data = req[target];
      const parsed = schema.parse(data);
      req[target] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message
        }));
        return next(new ValidationError('Invalid request', details));
      }
      next(err);
    }
  };
}

module.exports = validate;
