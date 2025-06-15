<template>
  <div class="container py-4 bg-dark text-light rounded">
    <h1 class="mb-4">My Links</h1>
    <div v-if="links.length === 0" class="alert alert-secondary bg-secondary text-light border-0">
      <p class="mb-0">你还没有创建任何链接。</p>
    </div>
    <b-table
      v-else
      :items="links"
      :fields="fields"
      striped
      dark
      small
      responsive
      class="bg-dark text-light border-secondary rounded"
      head-variant="dark"
    >
      <template #cell(linkname)="data">
        <strong>{{ data.item.linkname || data.item.goLink }}</strong>
      </template>
      <template #cell(dest)="data">
        <a :href="data.item.dest" target="_blank">{{ data.item.dest }}</a>
      </template>
    </b-table>
  </div>
</template>

<script>
export default {
  name: 'UserPage',
  data() {
    return {
      links: [],
      fields: [
        { key: 'linkname', label: 'Link Name' },
        { key: 'dest', label: 'Destination' },
      ]
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
/* 让滚动条也适配暗色 */
.container::-webkit-scrollbar {
  background: #222;
}
.container::-webkit-scrollbar-thumb {
  background: #444;
}
</style> 