<template class="h-100">
  <section class="h-100 d-flex flex-column bg-dark">
    <header class="container">
      <nav class="navbar navbar-expand-lg navbar-light bg-dark">
        <a class="navbar-brand text-white" href="/">{{title}}</a>
        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNav"
                aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation"><span
          class="navbar-toggler-icon"></span></button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav">
            <li class="nav-item active"><a class="nav-link text-white" href="#"><span
              class="sr-only">(current)</span></a></li>
            <li class="nav-item"><a class="nav-link text-white" href="/dashboard">Dashboard</a></li>
            <template v-if="loggedIn">
              <li class="nav-item"><a class="nav-link text-white" href="/user-links">My Links</a></li>
              <li class="nav-item"><a class="nav-link text-white" href="/logout">Log Out</a></li>
            </template>
            <template v-else >
              <li class="nav-item"><a class="btn btn-primary btn-sm nav-link text-white" href="/login?returnTo=/">Log In</a></li>
            </template>
          </ul>
        </div>
      </nav>
    </header>
    <nuxt class="container-lg h-100"/>
    <footer class="container"/>
  </section>
</template>

<script>
  import {Component, Prop, Vue} from 'nuxt-property-decorator';
  @Component({
  })
  export default class DefaultLayout extends Vue {
    title = this.$env.OPEN_GOLINKS_SITE_NAME;
    get loggedIn() {
      return this.$store.state.user !== null;
    }

    mounted() {
      console.log('[mounted][debug] this.$store.state.user:', this.$store.state.user);
      console.log('[mounted][debug] this.$store.state.userId:', this.$store.state.userId);
    }
  }

</script>
<style scoped>
</style>
