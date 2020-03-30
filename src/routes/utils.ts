export const asyncHandler = fn => (req, res, next) =>
    Promise
        .resolve(fn(req, res, next))
        .catch(next);

export const LINKNAME_PATTERN = '[A-Za-z0-9-_]+';
