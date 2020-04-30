<template>

  <div class="qr-code-section d-flex bg-white p-3 rounded">
    <div class="mr-3">
      <div><img class="border qr_code" :src="qrCodeApiUrl"/></div>
      <div class="w-100 mt-2 "><a class="btn btn-outline-secondary btn-sm width-128" :href="`/qr/d/${goLink}.png`">Download</a></div>
    </div>
    <div class="border-right mr-3"></div>
    <div >
      <div>
        <div class="input-group">
          <b-form-textarea :value="caption" style="width: 200px;height: 100px"
            @input="updateCaption($event)"
            class="form-control" id="qrcode_caption"  placeholder="add a description" name="caption"/>
        </div>
      </div>
      <div>
        <span class="text-secondary"><small>20 character or less</small></span>
      </div>
      <div class="my-1 form-check mt-1">
        <input class="form-check-input" id="checkbox_qrcode_logo"
          :checked="addLogo"
          @input="$emit('update:addLogo', $event.target.checked)"
          type="checkbox" name="addLogo"/><label
        class="ml-2 form-check-label" for="checkbox_qrcode_logo">Add logo</label></div>
    </div>
  </div>
</template>

<script lang="ts">
  import {Component, Prop, Vue} from 'vue-property-decorator';

  @Component
  export default class QrCodeEditor extends Vue {
      @Prop({type: String, required: true}) readonly goLink: string;
      @Prop({type: String, required: true}) readonly caption: string;
      @Prop({type: Boolean, required: true}) readonly addLogo: boolean;

    get qrCodeApiUrl() {
      let url = `/qr/${this.goLink}.png`;
      url += `?addLogo=${this.addLogo.toString()}`;
      if (this.caption) url += `&caption=${ this.caption}`;
      return encodeURI(url);
    }
    updateCaption = function(event) {
      this.$emit('update:caption', event)
    }
  }
</script>

<style scoped>
  .width-128 {
    width: 128px;
  }
  .qr_code {
    width: 128px;
    height: 128px;
  }
</style>
