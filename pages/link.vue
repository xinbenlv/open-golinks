<template>
  <section>
    <div class="main d-flex flex-column justify-content-center h-100">
      <ValidationObserver v-slot="{ invalid, valid, dirty, pristine }">
      <div class="row">
        <div class="col-12">
          <div class="card shadow">
            <div class="card-header bg-ex-gray border-bottom-0 text-center d-flex justify-content-between">
              <h5 style="height: 20px; line-height: 20px">
                <i :class="{
                  'fa-check-circle': msgType === 'success',
                  'text-success': msgType === 'success',
                  'fa-pencil-alt': msgType === 'editing',
                  'fa-plus': msgType === 'creating'
                }" class="fas text-lg mr-1"></i>
                <span class="">{{msg}}</span>
              </h5>
              <div style="height: 20px;">
                <div class="btn-group">
                  <!-- when it's in a link creation process, show a button to create a link -->
                  <button v-if="status === `Creating`" class="btn btn-primary btn-sm"
                          :disabled="pristine || invalid"
                          @click="submitBtn()">Create
                  </button>
                  <!-- if not in a creation process, for anonymously created link, allow anyone to claim" -->
                  <button v-else-if="$store.state.userId && $store.state.userId === author" class="btn btn-primary btn-sm"
                          @click="submitBtn()">Update
                  </button>
                  <button v-else-if="$store.state.userId && author === 'anonymous'" class="btn btn-primary btn-sm"
                          @click="submitBtn()"
                          style="width:120px;">Claim to update
                  </button>
                  <button v-else-if="!$store.state.userId" class="btn btn-primary btn-sm"
                          style="width:120px;"
                          @click="login()">Login to claim
                  </button>
                </div>
              </div>
            </div>
            <div class="card-body bg-ex-gray pt-0">
              <div class="row">
                <div class="col-md-6 col-sm-12 border-right">
                  <b-form-group style="height:80px"><label for="dest">Long Url <span class="label-small-note">REQUIRED</span></label>
                    <validation-provider
                      name="Long Url"
                      :rules="{ required: true, goDestRule: true}"
                      v-slot="goDestValidationContext"
                    >
                    <b-input-group class="input-group" >
                      <b-form-input v-model="goDest"
                        class="form-control" id="dest" type="text" name="dest"
                        :state="getValidationState(goDestValidationContext)"
                        />
                      <b-form-invalid-feedback >{{ goDestValidationContext.errors[0] }}</b-form-invalid-feedback>
                    </b-input-group>
                    </validation-provider>
                  </b-form-group>
                  <b-form-group style="height:80px">
                    <validation-provider
                      name="Short Url"
                      :rules="{ required:true, goLinkPattern: true, goLinkAvailable: true }"
                      v-slot="goLinkValidationContext"
                    >
                      <label>Short Url <span class="label-small-note">REQUIRED</span></label>
                      <b-input-group>
                        <b-input-group-prepend><span class="input-group-text text-primary">{{siteHost}}/</span>
                        </b-input-group-prepend>
                        <b-form-input ref="goLinkInput" class="text-primary form-control" id="golink" type="text" name="golink"
                               v-model="goLink"
                               placeholder="short url here"
                               :disabled="shouldLockGoLink"
                               :state="getValidationState(goLinkValidationContext)"
                               />
                        <b-input-group-append>
                          <button
                            class="btn btn-primary rounded-right" id="btn_copy_short_url"
                            type="button"
                            v-clipboard:copy="`${siteProtocol}://${siteHost}/${goLink}`"
                            v-clipboard:success="onCopy"
                            style="width:120px;">Copy</button>
                        </b-input-group-append>
                        <b-form-invalid-feedback class="mr-1">{{ goLinkValidationContext.errors[0] }}</b-form-invalid-feedback>
                      </b-input-group>
                    </validation-provider>
                  </b-form-group>
                  <div class="d-flex justify-content-between align-self-center">
                    <div id="owner"><span><b>Owner: </b>{{author || 'anonymous'}}</span></div>
                  </div>
                </div>
                <div class="col-md-6 col-sm-12">
                  <label for="qr_code_editor">QRCode<span class="ml-1 label-small-note">OPTIONAL</span></label>
                  <qr-code-editor id="qr_code_editor"
                    :caption.sync='caption'
                    :addLogo.sync="addLogo"
                    :goLink="goLink"
                  ></qr-code-editor>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </ValidationObserver>
    </div>
  </section>
</template>

<script lang="ts">
    import QrCodeEditor from '~/components/QrCodeEditor.vue';
    import { ValidationObserver, ValidationProvider } from "vee-validate";
    import {GOLINK_PATTERN} from "~/src/shared";
    import {Component, Vue} from 'nuxt-property-decorator';
    const successMessage = `You have successfully created a shortlink!`;
    enum Status {
      Creating = 'Creating',
      Editing = 'Editing'
    }

    @Component({
      components: {
        QrCodeEditor,
        ValidationObserver: ValidationObserver,
        ValidationProvider: ValidationProvider
      }
    })
    export default class LinkPage extends Vue {
        declare $env:any;
        declare $bvToast:any;
        msg:string = `Create`;
        msgType:string = '';
        siteHost:string = 'open-go.link';
        siteProtocol:string = 'http';
        goLink:string = '';
        goDest:string = '';
        author:string = '';
        status:Status = Status.Creating;
        caption:string = '';
        addLogo:boolean = true;
        editable:boolean = true;
        async submitBtn() {
          let result = this.$axios.$post(`/api/v2/edit`, {
              golink: this.goLink,
              dest: this.goDest,
              addLogo: this.addLogo,
              caption: this.caption
          });

          this.msg = successMessage;
          this.msgType = 'success';
        }
        get shouldLockGoLink () {
          return this.status !== Status.Creating;
        };
        login() {
          window.open(`/login?returnTo=${window.location.pathname}`);
        };
        async asyncData({ params, $axios }) {
            return { goLink: params.goLink || '' };
        };
        validate({params}) {
          if (!params.goLink || RegExp(GOLINK_PATTERN).test(params.goLink)) return true;
          else throw new Error(
            `The link "${params.goLink}" doesn't match required pattern. It shall be 4 to 30 characters long, with lowercase letters, numbers and dash combined.`);
        };
        created() {
          if (this.$store.state.linkItem) {
            let linkItem = this.$store.state.linkItem;
            this.goLink = linkItem.goLink;
            this.goDest = linkItem.goDest;
            this.addLogo = linkItem.addLogo || false;
            this.caption = linkItem.caption || "";
            this.author = linkItem.author;
            this.editable = linkItem.editable;
            this.msg = 'Editing a Link';
            this.msgType = 'editing';
            this.status = Status.Editing;
          } else {
            this.status = Status.Creating;
            this.msgType = 'creating';
            this.msg = 'Creating a link';
          }
        }
        mounted () {
          this.siteHost = this.$env.OPEN_GOLINKS_SITE_HOST_AND_PORT;
          this.siteProtocol = this.$env.OPEN_GOLINKS_SITE_PROTOCOL;

        }
        getValidationState({ dirty, validated, valid = null }) {
          return dirty || validated ? valid : null;
        }

        onCopy (e) {
          this.$bvToast.toast(`${e.text}`, {
            title: 'Copied to clipboard',
            toaster: `b-toaster-bottom-center`
          });
        }

    }
</script>

<style scoped>
  #owner {
    line-height: 38px;
  }
  .label-small-note {
    font-family: Open Sans;
    font-style: normal;
    font-weight: 600;
    font-size: 8px;
    line-height: 11px;
    text-align: center;
    color: #6C6C6C;
  }

  .bg-ex-gray {
    background: #EDEDED!important;
  }
</style>
