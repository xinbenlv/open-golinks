<template>
  <div class="container py-4">
    <h1>My Links</h1>
    <div v-if="links.length === 0">
      <p>你还没有创建任何链接。</p>
    </div>
    <ul v-else>
      <li v-for="link in links" :key="link._id">
        <strong>{{ link.linkname || link.goLink }}</strong> → {{ link.goDest }}
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  name: 'UserPage',
  data() {
    return {
      links: []
    }
  },
  async mounted() {
    try {
      const res = await this.$axios.$get('/api/v2/my-links');
      this.links = res;
    } catch (e) {
      this.links = [];
    }
  }
}
</script>

<style scoped>
</style> 