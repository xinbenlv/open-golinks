<template>
  <section>
    <div class="main d-flex flex-column justify-content-center h-100">
      <div class="row">
        <div class="col-lg-6 offset-lg-3 col-md-8 offset-md-2">
          <div class="card shadow">
            <div class="card-header bg-light border-bottom-0 text-center">
              <h5>
                <i v-if="msgType==='success'" class="fas fa-check-circle text-lg pr-2 text-undefined text-success"></i>
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
                <div class="qr-code-section d-flex my-2">
                  <div>
                    <img v-if="hasQRCode" class="border qr_code" :src="`/qr/${goLink}.png`"/>
                    <div v-else class="border bg-white qr_code"></div>
                  </div>
                  <div class="ml-3 flex-grow-1">
                    <div>
                      <div class="input-group"><input class="form-control" id="qrcode_caption" type="text"
                                                      placeholder="add a description" name="caption"/>
                        <div class="input-group-append">
                          <button class="btn btn-outline-secondary" id="btn_update_caption" type="button"><i
                            class="fas fa-pen"></i></button>
                        </div>
                      </div>
                    </div>
                    <div><span class="text-secondary"><small>20 character or less</small></span></div>
                    <div class="my-1 form-check mt-1"><input class="form-check-input" id="checkbox_qrcode_logo"
                                                             type="checkbox" name="addLogo"/><label
                      class="ml-2 form-check-label" for="checkbox_qrcode_logo">Add ZaiGeZaiGu logo</label></div>
                    <div><a class="btn btn-outline-secondary btn-sm" href="/qr/d/undefined.png">Download</a></div>
                  </div>
                </div>
                <div class="d-flex justify-content-between align-self-center">
                  <div id="owner"><span><b>Owner: </b>{{goOwner || 'anonymous'}}</span></div>
                  <div class="btn-group">
                    <button class="btn btn-primary btn-sm" type="submit" value="Submit">Create</button>
                    <button class="btn btn-outline-primary btn-sm" type="submit" value="Submit">Update</button>
                    <button class="btn btn-outline-primary btn-sm" href="/login"
                       style="width:120px;">Login to claim</button></div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
  export default {
    name: "link.vue",
    data() {
      return {
        msg: `You have successfully created a shortlink!`,
        msgType: 'success',
        siteName: 'zgzg.link',
        goLink: 'fake_qr',
        goDest: 'https://foo.com/bar',
        goOwner: null,
        hasQRCode: true,
      }
    },
    created() {
    }
  }
</script>

<style scoped>
  .qr_code {
    width: 128px;
    height: 128px;
  }

  #owner {
    line-height: 38px;
  }
</style>
