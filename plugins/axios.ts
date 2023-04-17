export default ({ $axios, app }) => {
  $axios.onRequest(config => {
    if (process.client) {
      console.log(`Setting baseURL to ""(empyt).`);
      config.baseURL = "";
    } else {
      console.log(`Setting baseURL to ${app.$env.OPEN_GOLINKS_SITE_PROTOCOL}://${app.$env.OPEN_GOLINKS_SITE_HOST_AND_PORT}`);
      config.baseURL = `${app.$env.OPEN_GOLINKS_SITE_PROTOCOL}://${app.$env.OPEN_GOLINKS_SITE_HOST_AND_PORT}`;
    }
  });
}
