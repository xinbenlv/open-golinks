<template>

  <div class="qr-code-section d-flex my-2">
    <div>
      <img class="border qr_code" :src="`/qr/${goLink}.png`"/>
    </div>
    <div class="ml-3 flex-grow-1">
      <div>
        <div class="input-group">
          <input :value="caption"
            @input="$emit('update:caption', $event.target.value)"
            class="form-control" id="qrcode_caption" type="text" placeholder="add a description" name="caption"/>
          <div class="input-group-append">
            <button class="btn btn-outline-secondary" id="btn_update_caption" type="button"><i
              class="fas fa-pen"></i></button>
          </div>
        </div>
      </div>
      <div><span class="text-secondary"><small>20 character or less</small></span></div>
      <div class="my-1 form-check mt-1">
        <input class="form-check-input" id="checkbox_qrcode_logo"
          :checked="addLogo"
          @input="$emit('update:addLogo', $event.target.checked)"
          type="checkbox" name="addLogo"/><label
        class="ml-2 form-check-label" for="checkbox_qrcode_logo">Add ZaiGeZaiGu logo</label></div>
      <div><a class="btn btn-outline-secondary btn-sm" :href="`/qr/d/${goLink}.png`">Download</a></div>
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
  }
</script>

<style scoped>
  .qr_code {
    width: 128px;
    height: 128px;
  }
</style>
