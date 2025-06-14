import {GOLINK_PATTERN} from "../src/shared";

export const state = () => ({
  flags: {},
  linkItem: null,
  user: null,
  userId: null,
});

export const mutations = {
  setUser(state, user) {
    state.user = user;
  },
  setUserId(state, userId) {
    state.userId = userId;
  },
  setLinkItem (state, linkItem) {
    state.linkItem = linkItem;
  },

};

export const actions = {
  async nuxtServerInit({ commit, state }, ctx2) {
    console.log('[nuxtServerInit] ctx2.req.user:', ctx2.req && ctx2.req.user);
    if (ctx2.req.user) {
      commit('setUser', ctx2.req.user);
      commit('setUserId', ctx2.req.user.emails[0].value);
      console.log('[nuxtServerInit] setUser:', ctx2.req.user);
    } else {
      console.log('[nuxtServerInit] No user found in req');
    }
    let goLink = ctx2.params.goLink;
    if (goLink && new RegExp(GOLINK_PATTERN).test(goLink)) {
      let linkItems = await this.$axios.$get(`/api/v2/link/${goLink}`);
      if (linkItems.length == 1) {
        commit('setLinkItem', linkItems[0]);
      } else {
        ctx2.redirect(`/edit/${goLink}`);
      }
    }

  }
};
