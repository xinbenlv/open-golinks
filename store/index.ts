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
  async nuxtServerInit({ commit, state, }, ctx2) {
    if(ctx2.req.user) {
      commit('setUser', ctx2.req.user);
      commit('setUserId', ctx2.req.user.emails[0].value)
    }
  }
};
