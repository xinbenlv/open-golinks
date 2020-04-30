import { extend } from 'vee-validate';
import { required, min, regex } from 'vee-validate/dist/rules';
import {GOLINK_PATTERN, URL_PATTERN} from '~/src/shared';
import {ValidationRuleSchema} from 'vee-validate/dist/types/types';

export default ({ $axios, app }) => {
// No message specified.
  extend('regex', regex);
  extend('required', {
    ...required,
    message: field => `${field} is required.`
  });
  extend('min', min);
  extend('goLinkPattern', {
    computesRequired: true,
    message: field => `${field} shall match ${GOLINK_PATTERN}.`,
    validate: value => {
      let result = new RegExp(`^${GOLINK_PATTERN}$`).test(value);
      return result;
    }
  } as ValidationRuleSchema);

  extend('goLinkAvailable', {
    computesRequired: true,
    message: (field, placeholders) =>
      `The ${field} "${placeholders._value_}" is already taken.`,
    validate: async (value) => {
      let result = await $axios.get(`/api/v2/available/${value}`);
      if (result.data) {
        return true;
      }
      return {
        valid: false,
        data: {
          goLink: value
        }
      };
    }
  } as ValidationRuleSchema);

  extend('goDestRule', {
    computesRequired: true,
    message: field => `${field} shall be a valid url.`,
    validate: value => new RegExp(URL_PATTERN).test(value)
  } as ValidationRuleSchema);
}

