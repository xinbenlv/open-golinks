<template>
  <section>
    <div class="main d-flex flex-column justify-content-center h-100">
      <div class="row">
        <div class="col-lg-6 offset-lg-3 col-md-8 offset-md-2">
          <div class="card shadow">
            <div class="card-header bg-light border-bottom-0 text-center">
              <h5>
                <i v-if="msgType==='success'" class="fas fa-check-circle text-lg pr-2 text-success"></i>
                <span class="ml-1">{{msg}}</span>
              </h5>
            </div>
            <div class="card-body bg-light pt-0">
              <div class="form-group"><label for="dest">Long Url</label>
                <div class="input-group">
                  <input v-model="goDest" class="form-control" id="dest" type="text" name="dest"/>
                  <div class="input-group-append">
                    <button class="btn btn-outline-secondary" id="btn_updatet_short_url" type="button"><i
                      class="fas fa-pen"></i></button>
                  </div>
                </div>
              </div>
              <div class="form-group"><label for="golink">Short Url</label>
                <div class="input-group">
                  <div class="input-group-prepend"><span class="input-group-text text-primary">{{siteName}}/</span>
                  </div>
                  <input ref="goLinkInput" class="text-primary form-control" id="golink" type="text" name="golink"
                         v-model="goLink"
                         placeholder="Input the short url here"
                         :disabled="shouldLockGoLink"
                         />
                  <div class="input-group-append">
                    <button class="btn btn-primary" id="btn_copy_short_url" type="button" style="width:120px;">Copy
                      URL
                    </button>
                  </div>
                </div>
              </div>
              <qr-code-editor
                :caption="caption"
                :caption.sync='caption'
                :addLogo.sync="addLogo"
                :goLink="goLink"
              ></qr-code-editor>
              <div class="d-flex justify-content-between align-self-center">
                <div id="owner"><span><b>Owner: </b>{{author || 'anonymous'}}</span></div>
                <div class="btn-group">
                  <!-- when it's in a link creation process, show a button to create a link -->
                  <button v-if="status === `Creating`" class="btn btn-primary btn-sm"
                          @click="submitBtn()">Create
                  </button>
                  <!-- if not in a creation process, for anonymously created link, allow anyone to claim" -->
                  <button v-else-if="$store.state.userId && $store.state.userId === author" class="btn btn-primary btn-sm"
                          @click="submitBtn()">Update
                  </button>
                  <button v-else-if="$store.state.userId && author === 'anonymous'" class="btn btn-primary btn-sm" href="/login"
                          @click="submitBtn()"
                          style="width:120px;">Claim to update
                  </button>
                  <button v-else-if="!$store.state.userId" class="btn btn-primary btn-sm" href="/login"
                          style="width:120px;"
                          @click="login()">Login to claim
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
    import QrCodeEditor from '~/components/QrCodeEditor.vue';

    import {GOLINK_PATTERN} from "~/src/shared";
    import {Component, Prop, Vue} from 'nuxt-property-decorator';
    const successMessage = `You have successfully created a shortlink!`;
    enum Status {
      Creating = 'Creating',
      Editing = 'Editing'
    }

    @Component({
        components: {
            QrCodeEditor
        }
    })
    export default class LinkPage extends Vue {
        msg:string = `Create`;
        msgType:string = '';
        siteName:string = 'zgzg.link';
        goLink:string = '';
        goDest:string = '';
        author:string = '';
        status:Status = Status.Creating;
        caption:string = '';
        addLogo:boolean = true;
        editable:boolean = true;
        async submitBtn() {
          let result = this.$axios.$post(`/edit`/* old endpoint */, {
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
          window.open(`/login`);
        };
        async asyncData({ params, $axios }) {
            return { goLink: params.goLink || 'new' };
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
            this.status = Status.Editing;
          } else {
            this.status = Status.Creating;
            this.msg = 'Creating a link';
          }
        }
    }
</script>

<style scoped>
  #owner {
    line-height: 38px;
  }
</style>
