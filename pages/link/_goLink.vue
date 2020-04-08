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
              <form class="p-2" method="POST" action="/edit">
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
                    <input class="text-primary form-control" id="golink" type="text" name="golink"
                           v-model="goLink" placeholder="Input the short url here"/>
                    <div class="input-group-append">
                      <button class="btn btn-primary" id="btn_copy_short_url" type="button" style="width:120px;">Copy
                        URL
                      </button>
                    </div>
                  </div>
                </div>
                <qr-code-editor
                  :capation="caption"
                  :caption.sync='caption'
                  :addLogo.sync="addLogo"
                  :goLink="goLink"
                  :hasQrCode="hasQrCode"
                ></qr-code-editor>
                <div class="d-flex justify-content-between align-self-center">
                  <div id="owner"><span><b>Owner: </b>{{goOwner || 'anonymous'}}</span></div>
                  <div class="btn-group">
                    <!-- when it's in a link creation process, show a button to create a link -->
                    <button v-if="status === `new`" class="btn btn-primary btn-sm" type="submit" value="Submit">Create
                    </button>
                    <!-- if not in a creation process, for anonymously created link, allow anyone to claim" -->
                    <button v-else-if="$store.state.userId && $store.state.userId === goOwner" class="btn btn-outline-primary btn-sm"
                            type="submit" value="Submit">Update
                    </button>
                    <button v-else-if="$store.state.userId && !goOwner" class="btn btn-outline-primary btn-sm" href="/login"
                            style="width:120px;">Claim to update
                    </button>
                    <button v-else-if="!$store.state.userId" class="btn btn-outline-primary btn-sm" href="/login"
                            style="width:120px;">Login to claim
                    </button>
                  </div>
                </div>
              </form>
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

    export default {
        components: {
            QrCodeEditor,
        },
        data() {
            return {
                msg: `You have successfully created a shortlink!`,
                msgType: 'success',
                siteName: 'zgzg.link',
                goLink: 'fake_qr',
                goDest: 'https://foo.com/bar',
                goOwner: null,
                hasQrCode: true,
                status: 'new',
                caption: null,
                addLogo: true,
            }
        },
        async asyncData({ params, $axios }) {
            return { goLink: params.goLink || 'new' };
        },
        validate({params}) {
          if (!params.goLink || RegExp(GOLINK_PATTERN).test(params.goLink)) return true;
          else throw new Error(
            `The link "${params.goLink}" doesn't match required pattern. It shall be 4 to 30 characters long, with lowercase letters, numbers and dash combined.`);
        },
        methods: {
            updateCaption: (value) => {
                this.caption = value;
            }
        },
        created() {
        }
    }
</script>

<style scoped>
  #owner {
    line-height: 38px;
  }
</style>
