<template>

  <div class="qr-code-section d-flex bg-white p-3 rounded">
    <div class="mr-3">
      <div>
        <img v-if="isGoLinkValid" class="border qr-code-canvas" :src="qrCodeApiUrl"/>
        <div v-else class="qr-code-canvas border bg-light"></div>
      </div>
      <div class="w-100 mt-2"><a class="btn btn-outline-secondary btn-sm download-btn" :href="qrCodeDownloadApiUrl">Download</a></div>
    </div>
    <div class="border-right mr-3"></div>
    <div >
      <div>
        <div class="input-group">
          <b-form-textarea :value="caption"
            @input="updateCaption($event)"
            class="caption-area form-control" id="qrcode_caption"  placeholder="add a description" name="caption"/>
        </div>
      </div>
      <div>
        <span class="text-secondary"><small>20 character or less</small></span>
      </div>
      <div class="form-check">
        <input class="form-check-input" id="checkbox_qrcode_logo"
          :checked="addLogo"
          @input="$emit('update:addLogo', $event.target.checked)"
          type="checkbox" name="addLogo"/><label
        class="ml-2 form-check-label" for="checkbox_qrcode_logo">logo</label></div>
    </div>
  </div>
</template>

<script lang="ts">
  import {Component, Prop, Vue} from 'vue-property-decorator';
  import {GOLINK_PATTERN} from '~/src/shared';

  @Component
  export default class QrCodeEditor extends Vue {
      @Prop({type: String, required: true}) readonly goLink: string;
      @Prop({type: String, required: true}) readonly caption: string;
      @Prop({type: Boolean, required: true}) readonly addLogo: boolean;

    get qrCodeDownloadApiUrl() {
      let url = `/qr/d/${this.goLink}.png`;
      url += `?addLogo=${this.addLogo.toString()}`;
      if (this.caption) url += `&caption=${ this.caption}`;
      return encodeURI(url);
    }
    get qrCodeApiUrl() {
      let url = `/qr/${this.goLink}.png`;
      url += `?addLogo=${this.addLogo.toString()}`;
      if (this.caption) url += `&caption=${ this.caption}`;
      return encodeURI(url);
    }
    get isGoLinkValid() {
      return new RegExp(`^${GOLINK_PATTERN}$`).test(this.goLink);
    }
    updateCaption = function(event) {
      this.$emit('update:caption', event)
    }
  }
</script>

<style>
  .download-btn {
    width: 200px;
  }
  .caption-area {
    width: 200px;
    height: 100px;
  }

  .qr-code-canvas {
    width: 200px;
    height: 260px;
  }
</style>
