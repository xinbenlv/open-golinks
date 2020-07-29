import {GOLINK_PATTERN} from './src/shared';

const pkg = require('./package');
require(`dotenv`).config();

export default {
  telemetry: false, // https://github.com/nuxt/telemetry
  mode: 'universal',

  /*
   ** Headers of the page
   */
  head: {
    title: process.env.OPEN_GOLINKS_SITE_NAME,
    meta: [
      {charset: 'utf-8'},
      {name: 'viewport', content: 'width=device-width, initial-scale=1'},
      {hid: 'description', name: 'description', content: pkg.description},
      {uptimerobot_verify_uuid: '89d70f81-d069-43cf-ad7f-b932f7e3a24b'}, // a random uuid for verification purpose
    ],
    link: [
      // rel: 'icon', type: 'image/x-icon', href: '/favicon.ico'},
      {
        rel: 'stylesheet',
        href: 'https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/css/bootstrap.min.css',
        // integrity: 'sha384-MCw98/SFnGE8fJT3GXwEOngsV7Zt27NXFoaoApmYm81iuXoPkFOJwJ8ERdknLPMO',
      },
      {
        rel: 'stylesheet',
        href: 'https://use.fontawesome.com/releases/v5.8.1/css/all.css',
        // integrity: 'sha384-50oBUHEmvpQ+1lW4y57PTFmhCaXp0ML5d60M1M7uH2+nqUivzIebhndOJK28anvf',
        // crossorigin: 'anonymouse'
      }
    ],
    script: [
      {
        src: "https://code.jquery.com/jquery-3.3.1.slim.min.js",
        //integrity: "sha384-q8i/X+965DzO0rT7abK41JStQIAqVgRVzpbzo5smXKp4YfRvH+8abtTE1Pi6jizo",
        type: "text/javascript",
        //crossorigin: "anonymous"
      },
      {
        src: "https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.3/umd/popper.min.js",
        //integrity: "sha384-ZMP7rVo3mIykV+2+9J3UJ46jBk0WLaUAdn689aCwoqbBJiSnjAK/l8WvCWPIPm49",
        type: "text/javascript",
        //crossorigin: "anonymous"
      },
      {
        src: "https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/js/bootstrap.min.js",
        //integrity: "sha384-ChfqqxuZUCnJSK3+MXmPNIyE6ZbWh2IMqE241rYiqJxyMiZ6OW/JmZQ5stwEULTy",
        type: "text/javascript",
        //crossorigin: "anonymous"
      },
    ],
    bodyAttrs: {
      class: 'h-100'
    },
  },

  /*
   ** Customize the progress-bar color
   */
  loading: {color: '#fff'},

  /*
   ** Global CSS
   */
  css: [
    `@/static/css/main.css`,
  ],

  // Define your configuration with auto-completion & type checking
  buildModules: ['@nuxt/typescript-build'],
  /*
     ** Nuxt.js modules
     */
  modules: [
    // Doc: https://axios.nuxtjs.org/usage
    '@nuxtjs/axios',
    // Doc: https://bootstrap-vue.js.org/docs/
    'bootstrap-vue/nuxt',
    ['nuxt-env', {
      keys: [
        'HOST',
        'PORT',
        'OPEN_GOLINKS_SITE_HOST',
        'OPEN_GOLINKS_SITE_NAME',
      ]
    }],
  ],
  /*
   ** Axios module configuration
   */
  axios: {
    // See https://github.com/nuxt-community/axios-module#options
    credentials: true
  },

  bootstrapVue: {
    config: {
      // Custom config options here
    }
  },

  /*
   ** Build configuration
   */
  build: {
    babel: {
      presets({ isServer }) {
        return [
          [
            "@nuxt/babel-preset-app", { loose: true }
          ]
        ]
      }
    },
    transpile: [
      "vee-validate/dist/rules",
      "vee-validate/dist/vee-validate.full.esm"
      ],
    extend (config, {isDev, isClient}) {
      if (isDev) {
        config.devtool = isClient ? 'source-map' : 'inline-source-map';
      }
    },
  },

  router: {
    extendRoutes (routes, resolve) {
      routes.push({
        path: `/dashboard`,
        component: resolve(__dirname, "pages/dashboard.vue")
      });
      routes.push({
        path: `/link/:goLink(${GOLINK_PATTERN})?`,
        component: resolve(__dirname, 'pages/link.vue'),
      });
      routes.push({
        path: `/edit/:goLink(${GOLINK_PATTERN})?`,
        component: resolve(__dirname, 'pages/link.vue'),
      });
      routes.push({
        path: `/:goLink(${GOLINK_PATTERN})?`,
        component: resolve(__dirname, 'pages/redirect.vue'),
      });
    }
  },

  /*
  ** Plugins to load before mounting the App
  */
  plugins: [
    '@/plugins/axios.ts',
    "@/plugins/vee-validate.ts",
    "@/plugins/clipboard.ts"
  ],

};
