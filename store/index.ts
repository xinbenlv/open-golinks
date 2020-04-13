import {GOLINK_PATTERN} from "../src/shared";

export const state = () => ({
  flags: {},
  linkItem: {},
});

export const mutations = {

  setLinkItem (state, linkItem) {
    state.linkItem = linkItem;
  },

};

export const actions = {
  async nuxtServerInit({ commit, state, }, ctx2) {
    if (ctx2.route.path == 'edit') {
      return;
    }
    let goLink = ctx2.params.goLink;
    if (goLink && new RegExp(GOLINK_PATTERN).test(goLink)) {
      let linkItems = await this.$axios.$get(`/api/v2/link/${goLink}`);
      if (linkItems.length == 1) {
        commit('setLinkItem', linkItems[0]);
      } else {
        ctx2.redirect(`/edit/${goLink}`);
      }
    } else {
      ctx2.redirect(`/edit`);
    }
  }
};
