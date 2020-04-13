/**
 *  [a-z] start with lowercase letter;
 *  [a-z0-9\-_] allow lowercase letters, numbers and dash;
 *  {3, } at least 1(first-letter) + 3 characters, less or equal than 30 characters
 *  TODO(xinbenlv): handle length too long issue.
 */
export const GOLINK_PATTERN = `[a-z0-9][a-z0-9\-]{3,29}`;
